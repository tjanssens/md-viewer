pub mod feedback;
pub mod highlight;
pub mod render;
pub mod updater;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use render::Block;

/// What the frontend gets when a document is opened.
#[derive(Debug, Clone, Serialize)]
pub struct Opened {
    path: String,
    name: String,
    blocks: Vec<Block>,
}

struct Prefetched {
    path: PathBuf,
    content: String,
    blocks: Vec<Block>,
}

#[derive(Default)]
struct Doc {
    path: Option<PathBuf>,
    /// Latest text: what is on disk, or the unsaved text from the editor.
    content: String,
    /// Hash of what we believe is on disk; used to ignore our own saves.
    disk_hash: u64,
    /// Text read from disk after an external change, waiting for the UI.
    pending_disk: Option<String>,
    /// Block ids the frontend currently has in its DOM.
    known: HashSet<String>,
}

#[derive(Default)]
struct AppState {
    doc: Mutex<Doc>,
    prefetch: Mutex<Option<JoinHandle<Option<Prefetched>>>>,
    initial_path: Mutex<Option<PathBuf>>,
    frontend_ready: Mutex<bool>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
    zoom: Mutex<f64>,
}

fn read_text(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut s = String::from_utf8(bytes).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned());
    if s.starts_with('\u{feff}') {
        s.remove(0);
    }
    Ok(s)
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn set_title(app: &AppHandle, path: Option<&Path>, dirty: bool) {
    if let Some(w) = main_window(app) {
        let title = match path {
            Some(p) => format!("MD Viewer - {}{}", file_name(p), if dirty { " •" } else { "" }),
            None => "MD Viewer".to_string(),
        };
        let _ = w.set_title(&title);
    }
}

fn prefetch(path: PathBuf) -> JoinHandle<Option<Prefetched>> {
    std::thread::spawn(move || {
        let content = read_text(&path).ok()?;
        let blocks = render::render_blocks(&content, path.parent());
        Some(Prefetched { path, content, blocks })
    })
}

/// Make `path` the current document and start watching it.
fn install_doc(app: &AppHandle, state: &AppState, path: PathBuf, content: String, mut blocks: Vec<Block>) -> Opened {
    let mut doc = state.doc.lock().unwrap();
    render::strip_known(&mut blocks, &mut doc.known, true);
    doc.disk_hash = render::fnv1a(content.as_bytes());
    doc.content = content;
    doc.path = Some(path.clone());
    doc.pending_disk = None;
    drop(doc);
    set_title(app, Some(&path), false);
    start_watcher(app, state, &path);
    Opened { path: path.to_string_lossy().into_owned(), name: file_name(&path), blocks }
}

fn open_path_inner(app: &AppHandle, state: &AppState, path: PathBuf) -> Result<Opened, String> {
    let content = read_text(&path)?;
    let blocks = render::render_blocks(&content, path.parent());
    Ok(install_doc(app, state, path, content, blocks))
}

// ---------------------------------------------------------------- watcher

fn start_watcher(app: &AppHandle, state: &AppState, path: &Path) {
    let mut slot = state.watcher.lock().unwrap();
    *slot = None; // drop the old watcher
    let Some(dir) = path.parent().map(Path::to_path_buf) else { return };
    let target = path.to_path_buf();
    let (tx, rx) = mpsc::channel::<()>();
    let target_name = target.file_name().map(|n| n.to_os_string());
    let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(ev) = res {
            if ev.kind.is_access() {
                return;
            }
            if ev.paths.iter().any(|p| p.file_name().map(|n| n.to_os_string()) == target_name) {
                let _ = tx.send(());
            }
        }
    });
    let Ok(mut watcher) = watcher else { return };
    // Watch the folder: editors often save by writing a temp file and renaming.
    if watcher.watch(&dir, RecursiveMode::NonRecursive).is_err() {
        return;
    }
    *slot = Some(watcher);

    let app = app.clone();
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            // Debounce bursts of events.
            while rx.recv_timeout(Duration::from_millis(50)).is_ok() {}
            let state = app.state::<AppState>();
            let Ok(text) = read_text(&target) else { continue };
            let mut doc = state.doc.lock().unwrap();
            if doc.path.as_deref() != Some(target.as_path()) {
                return; // another document was opened; this thread is stale
            }
            let h = render::fnv1a(text.as_bytes());
            if h == doc.disk_hash {
                continue;
            }
            doc.disk_hash = h;
            doc.pending_disk = Some(text);
            drop(doc);
            let _ = app.emit("file-changed", ());
        }
    });
}

// ---------------------------------------------------------------- commands

#[tauri::command]
async fn init(app: AppHandle, state: State<'_, AppState>) -> Result<Option<Opened>, String> {
    *state.frontend_ready.lock().unwrap() = true;
    let handle = state.prefetch.lock().unwrap().take();
    if let Some(h) = handle {
        if let Ok(Some(p)) = h.join() {
            return Ok(Some(install_doc(&app, &state, p.path, p.content, p.blocks)));
        }
    }
    let initial = state.initial_path.lock().unwrap().take();
    match initial {
        Some(p) => open_path_inner(&app, &state, p).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn ready(app: AppHandle) {
    if let Some(w) = main_window(&app) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
async fn open_dialog(app: AppHandle, state: State<'_, AppState>) -> Result<Option<Opened>, String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Markdown Files", &["md", "markdown"])
        .add_filter("All Files", &["*"]);
    if let Some(w) = main_window(&app) {
        dialog = dialog.set_parent(&w);
    }
    let Some(picked) = dialog.blocking_pick_file() else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    open_path_inner(&app, &state, path).map(Some)
}

#[tauri::command]
async fn open_path(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<Opened, String> {
    open_path_inner(&app, &state, PathBuf::from(path))
}

#[tauri::command]
async fn get_content(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.doc.lock().unwrap().content.clone())
}

/// Render text from the editor (it becomes the current, unsaved content).
#[tauri::command]
async fn render(app: AppHandle, state: State<'_, AppState>, text: String, reset: bool) -> Result<Vec<Block>, String> {
    let dir = state.doc.lock().unwrap().path.as_ref().and_then(|p| p.parent().map(Path::to_path_buf));
    let mut blocks = render::render_blocks(&text, dir.as_deref());
    let mut doc = state.doc.lock().unwrap();
    render::strip_known(&mut blocks, &mut doc.known, reset);
    let dirty = render::fnv1a(text.as_bytes()) != doc.disk_hash;
    doc.content = text;
    let path = doc.path.clone();
    drop(doc);
    set_title(&app, path.as_deref(), dirty);
    Ok(blocks)
}

/// Re-render the current content, e.g. after the frontend rebuilt its DOM.
#[tauri::command]
async fn rerender(state: State<'_, AppState>, reset: bool) -> Result<Vec<Block>, String> {
    let (text, dir) = {
        let doc = state.doc.lock().unwrap();
        (doc.content.clone(), doc.path.as_ref().and_then(|p| p.parent().map(Path::to_path_buf)))
    };
    let mut blocks = render::render_blocks(&text, dir.as_deref());
    render::strip_known(&mut blocks, &mut state.doc.lock().unwrap().known, reset);
    Ok(blocks)
}

/// Accept the external change that was announced with `file-changed`.
#[tauri::command]
async fn reload_from_disk(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<Block>, String> {
    let (text, dir, path) = {
        let mut doc = state.doc.lock().unwrap();
        let Some(text) = doc.pending_disk.take() else {
            return Err("nothing to reload".into());
        };
        doc.content = text.clone();
        (text, doc.path.as_ref().and_then(|p| p.parent().map(Path::to_path_buf)), doc.path.clone())
    };
    let mut blocks = render::render_blocks(&text, dir.as_deref());
    render::strip_known(&mut blocks, &mut state.doc.lock().unwrap().known, false);
    set_title(&app, path.as_deref(), false);
    Ok(blocks)
}

#[tauri::command]
async fn discard_disk_change(state: State<'_, AppState>) -> Result<(), String> {
    state.doc.lock().unwrap().pending_disk = None;
    Ok(())
}

fn write_doc(app: &AppHandle, state: &AppState, path: &Path, text: Option<String>) -> Result<(), String> {
    let mut doc = state.doc.lock().unwrap();
    if let Some(t) = text {
        doc.content = t;
    }
    // Set the hash before writing so the watcher ignores our own save.
    doc.disk_hash = render::fnv1a(doc.content.as_bytes());
    std::fs::write(path, doc.content.as_bytes()).map_err(|e| e.to_string())?;
    let changed_path = doc.path.as_deref() != Some(path);
    doc.path = Some(path.to_path_buf());
    doc.pending_disk = None;
    drop(doc);
    set_title(app, Some(path), false);
    if changed_path {
        start_watcher(app, state, path);
    }
    Ok(())
}

#[tauri::command]
async fn save(app: AppHandle, state: State<'_, AppState>, text: Option<String>) -> Result<bool, String> {
    let path = state.doc.lock().unwrap().path.clone();
    match path {
        Some(p) => write_doc(&app, &state, &p, text).map(|_| true),
        None => Ok(save_as(app, state, text).await?.is_some()),
    }
}

#[derive(Serialize)]
struct SavedAs {
    path: String,
    name: String,
}

#[tauri::command]
async fn save_as(app: AppHandle, state: State<'_, AppState>, text: Option<String>) -> Result<Option<SavedAs>, String> {
    let current = state.doc.lock().unwrap().path.clone();
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Markdown Files", &["md"])
        .add_filter("All Files", &["*"]);
    match &current {
        Some(p) => {
            if let Some(d) = p.parent() {
                dialog = dialog.set_directory(d);
            }
            dialog = dialog.set_file_name(file_name(p));
        }
        None => dialog = dialog.set_file_name("untitled.md"),
    }
    if let Some(w) = main_window(&app) {
        dialog = dialog.set_parent(&w);
    }
    let Some(picked) = dialog.blocking_save_file() else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    write_doc(&app, &state, &path, text)?;
    Ok(Some(SavedAs { path: path.to_string_lossy().into_owned(), name: file_name(&path) }))
}

#[tauri::command]
async fn highlight(items: Vec<(String, String)>) -> Result<Vec<Option<String>>, String> {
    Ok(items.iter().map(|(lang, code)| highlight::highlight(lang, code)).collect())
}

#[tauri::command]
async fn highlight_css() -> Result<String, String> {
    Ok(highlight::css())
}

fn feedback_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("feedback")).map_err(|e| e.to_string())
}

#[tauri::command]
async fn feedback_load(app: AppHandle, path: String) -> Result<serde_json::Value, String> {
    Ok(feedback::load(&feedback_dir(&app)?, &path))
}

#[tauri::command]
async fn feedback_save(app: AppHandle, path: String, items: serde_json::Value) -> Result<(), String> {
    feedback::save(&feedback_dir(&app)?, &path, items)
}

#[tauri::command]
fn print(app: AppHandle) -> Result<(), String> {
    main_window(&app).ok_or("no window")?.print().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")) {
        return Err("unsupported url".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_updates(app: AppHandle) {
    std::thread::spawn(move || updater::check(app, false));
}

#[tauri::command]
fn install_update(app: AppHandle) -> Result<(), String> {
    updater::install(&app)
}

#[tauri::command]
fn update_logs(app: AppHandle) -> Vec<String> {
    app.state::<updater::Updater>().logs()
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// ---------------------------------------------------------------- menu

fn set_zoom(app: &AppHandle, f: impl FnOnce(f64) -> f64) {
    let state = app.state::<AppState>();
    let mut z = state.zoom.lock().unwrap();
    *z = f(*z).clamp(0.5, 3.0);
    if let Some(w) = main_window(app) {
        let _ = w.set_zoom(*z);
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    let file = SubmenuBuilder::new(app, "File")
        .item(&item("open", "Open…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&item("save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("save_as", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .separator()
        .item(&item("print", "Print…", Some("CmdOrCtrl+P"))?)
        .separator()
        .item(&if cfg!(target_os = "macos") {
            PredefinedMenuItem::close_window(app, None)?
        } else {
            PredefinedMenuItem::quit(app, None)?
        })
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .select_all()
        .build()?;

    let mut view = SubmenuBuilder::new(app, "View")
        .item(&item("toggle_edit", "Toggle Edit Mode", Some("CmdOrCtrl+E"))?)
        .separator()
        .item(&item("zoom_reset", "Actual Size", Some("CmdOrCtrl+0"))?)
        .item(&item("zoom_in", "Zoom In", Some("CmdOrCtrl+="))?)
        .item(&item("zoom_out", "Zoom Out", Some("CmdOrCtrl+-"))?)
        .separator()
        .fullscreen();
    if cfg!(debug_assertions) {
        view = view.item(&item("devtools", "Developer Tools", Some("CmdOrCtrl+Alt+I"))?);
    }
    let view = view.build()?;

    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&item("send_feedback", "Send Feedback…", None)?)
        .item(&item("check_updates", "Check for Updates…", None)?)
        .separator()
        .item(&item("about", "About MD Viewer", None)?)
        .build()?;

    let mut menu = MenuBuilder::new(app);
    if cfg!(target_os = "macos") {
        let app_menu = SubmenuBuilder::new(app, "MD Viewer")
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu = menu.item(&app_menu);
    }
    menu.items(&[&file, &edit, &view, &window, &help]).build()
}

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "zoom_in" => set_zoom(app, |z| z + 0.1),
        "zoom_out" => set_zoom(app, |z| z - 0.1),
        "zoom_reset" => set_zoom(app, |_| 1.0),
        "check_updates" => check_updates(app.clone()),
        "about" => {
            let _ = app.opener().open_url("https://github.com/tjanssens/md-viewer", None::<&str>);
        }
        #[cfg(debug_assertions)]
        "devtools" => {
            if let Some(w) = main_window(app) {
                w.open_devtools();
            }
        }
        other => {
            let _ = app.emit("menu", other.to_string());
        }
    }
}

// ---------------------------------------------------------------- startup

fn is_markdown_arg(a: &str) -> bool {
    let l = a.to_ascii_lowercase();
    (l.ends_with(".md") || l.ends_with(".markdown") || l.ends_with(".mdown") || l.ends_with(".txt"))
        && Path::new(a).is_file()
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
/// A file was handed to us by the OS (macOS "open with", or drag and drop).
fn external_open(app: &AppHandle, path: PathBuf) {
    let state = app.state::<AppState>();
    if *state.frontend_ready.lock().unwrap() {
        let _ = app.emit("open-path", path.to_string_lossy().into_owned());
    } else {
        *state.prefetch.lock().unwrap() = Some(prefetch(path.clone()));
        *state.initial_path.lock().unwrap() = Some(path);
    }
}

pub fn run() {
    let initial = std::env::args().skip(1).find(|a| is_markdown_arg(a)).map(PathBuf::from);

    let state = AppState { zoom: Mutex::new(1.0), ..Default::default() };
    if let Some(p) = initial.clone() {
        // Read and render the file while the webview boots.
        *state.prefetch.lock().unwrap() = Some(prefetch(p.clone()));
        *state.initial_path.lock().unwrap() = Some(p);
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .manage(updater::Updater::default())
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_menu(&handle)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| on_menu(app, event.id().as_ref()));

            // Safety net: show the window even if the frontend never says it is ready.
            let h = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(1500));
                if let Some(w) = main_window(&h) {
                    if !w.is_visible().unwrap_or(true) {
                        let _ = w.show();
                    }
                }
            });
            // Warm up the highlighter and check for updates off the critical path.
            std::thread::spawn(highlight::prewarm);
            let h = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(4));
                updater::check(h, true);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                if let Some(p) = paths.iter().find(|p| p.is_file()) {
                    let _ = window.app_handle().emit("open-path", p.to_string_lossy().into_owned());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            init,
            ready,
            open_dialog,
            open_path,
            get_content,
            render,
            rerender,
            reload_from_disk,
            discard_disk_change,
            save,
            save_as,
            highlight,
            highlight_css,
            feedback_load,
            feedback_save,
            print,
            open_url,
            check_updates,
            install_update,
            update_logs,
            app_version
        ])
        .build(tauri::generate_context!())
        .expect("error while building MD Viewer");

    app.run(|_handle, _event| {
        #[cfg(target_os = "macos")]
        if let RunEvent::Opened { urls } = &_event {
            if let Some(path) = urls.iter().filter_map(|u| u.to_file_path().ok()).next() {
                external_open(_handle, path);
            }
        }
    });
}

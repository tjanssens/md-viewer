# MD Viewer

A fast Markdown viewer and editor for Windows and macOS.

## Download

**[Download the latest release](https://github.com/tjanssens/md-viewer/releases/latest)**: `MD-Viewer-Setup-<version>-x64.exe` for Windows, `MD-Viewer-<version>-arm64.dmg` for macOS.

## Features

- Markdown rendering (GitHub flavoured: tables, task lists, strikethrough, autolinks, alerts) with syntax highlighting.
- Edit mode with a split editor (CodeMirror) and live preview that follows the editor's scroll position.
- Font and size selection; theme selection: auto, light and dark.
- Document outline with heading navigation and feedback counts.
- Feedback annotations: select text, add a note, then copy all open feedback as Markdown. Items can be edited, marked processed, and are flagged when their text can no longer be found.
- Files reload automatically when they change on disk; a dialog asks first if you have unsaved edits.
- Relative images and links to other `.md` files work.
- File association for `.md` and `.markdown`, drag and drop, native menus and keyboard shortcuts, printing, zoom.
- Update check against GitHub releases (Windows downloads and installs; macOS opens the release page).

## How it is built (and why it is fast)

The app is a [Tauri 2](https://tauri.app) shell with a Rust core and a small frontend without a framework.

- **Startup.** It uses the system webview (WebView2 on Windows, WebKit on macOS) instead of shipping Chromium. A file passed on the command line is read and rendered on a background thread while the webview boots. The window is shown after the first render, so there is no blank flash.
- **Rendering.** Markdown is parsed in Rust with [comrak](https://github.com/kivikakk/comrak). Each top-level block is rendered separately and gets an id from a hash of its HTML. The frontend only touches the DOM for blocks whose id changed, so edits and reloads keep scroll position and selection. Off-screen blocks use `content-visibility: auto`, so the browser skips their layout and paint.
- **Code highlighting.** [syntect](https://github.com/trishume/syntect) in Rust, lazily: only code blocks near the viewport are highlighted, and results are cached.
- **Live reload.** A filesystem watcher (`notify`) on the document's folder, debounced to 50 ms. Saves made by the app itself are recognised by content hash and ignored.
- **Editor.** CodeMirror 6 is a separate chunk that only loads when you first open edit mode.
- **Safety.** Raw HTML in a document is sanitised (ammonia), and a strict Content Security Policy blocks scripts in documents.

Measured on a 900 KB test document (Linux, WebKitGTK, software rendering):

| | Old version (Electron + Angular + marked) | This version |
| --- | --- | --- |
| Markdown parse | ~42 ms (marked + highlight.js) | ~12 ms (comrak) |
| Update after a keystroke in edit mode | ~42 ms parse + ~180 ms full DOM replace | ~60 ms end to end, only changed blocks |
| Large file visible | n/a | ~0.3 s after the page starts |
| Frontend JavaScript at startup | Angular, zone.js, marked, all highlight.js languages | ~30 KB |

## Where data is stored

- Settings (font, size, theme): in the webview's local storage.
- Feedback: one JSON file per document in the app data folder (`%APPDATA%\com.mdviewer.app\feedback` on Windows, `~/Library/Application Support/com.mdviewer.app/feedback` on macOS).

## Development

Prerequisites: Node.js 20+, Rust (stable), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm start          # run the app in development mode
npm run check      # type check, frontend tests, Rust tests, frontend build
npm run dist       # build installers for the current OS
```

## Feedback that turns into code

The 📣 button (or **Help > Send Feedback…**) opens a short form. Sending it opens a
pre-filled "new issue" page on GitHub in your browser; you click **Create** there.
The app holds no GitHub token: the issue is posted with your own account. Issues from
the app carry the hidden marker `<!-- md-viewer-feedback -->`.

A scheduled Claude task in the project picks these issues up: it judges each one and
either comments why it will not do it (label `feedback-declined`), or implements it,
raises the patch version with `scripts/bump-patch.mjs`, opens a pull request and merges
it into `main` once "Build and Release" passes, which publishes a new release.

Only issues written by `tjanssens` are processed, and a change under `.github/` is never
merged automatically. To have an issue you wrote by hand picked up, add the `feedback`
label.

## Keyboard shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| Open File | Ctrl+O | Cmd+O |
| Save | Ctrl+S | Cmd+S |
| Save As | Ctrl+Shift+S | Cmd+Shift+S |
| Print | Ctrl+P | Cmd+P |
| Toggle Edit Mode | Ctrl+E | Cmd+E |
| Zoom In / Out / Reset | Ctrl+= / Ctrl+- / Ctrl+0 | Cmd+= / Cmd+- / Cmd+0 |

## Project structure

```text
md-viewer/
  src-tauri/       Rust: rendering, highlighting, file watching, feedback storage, menus, updater
  web/             Frontend: index.html, styles.css, src/ (TypeScript), test/ (Vitest)
  scripts/         Frontend build (esbuild)
  docs/            Specs and plans
```

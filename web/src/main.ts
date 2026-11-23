import { $ } from './dom';
import { api, Opened } from './ipc';
import { AppSettings, loadSettings, normalizeSettings, resolveTheme, saveSettings, Theme } from './settings';
import { FeedbackStore } from './feedback/store';
import { FeedbackSidebar } from './feedback/sidebar';
import { renderOutline } from './outline';
import { UpdatePanel } from './update';
import { ReportDialog } from './report';
import { AboutDialog } from './about';
import { Viewer, FeedbackRequest, dirname } from './viewer';
import type { Editor } from './editor';
import type { Block } from './blocks';

// ---------------------------------------------------------------- state

let settings: AppSettings = loadSettings();
let path: string | null = null;
let editMode = false;
let dirty = false;
let outlineOpen = false;
let sidebarOpen = false;
let editor: Editor | null = null;
let pendingFeedback: Omit<FeedbackRequest, 'rect'> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const store = new FeedbackStore();
const viewer = new Viewer($('viewer'), $('doc'), $('selection-button'), store);
const sidebar = new FeedbackSidebar($('sidebar'), store, () => toggleSidebar(false), id => viewer.scrollToFeedback(id));

/** All renders go through one queue so the Rust side and the DOM stay in step. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

// ---------------------------------------------------------------- settings / theme

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applySettings(s: AppSettings): void {
  const root = document.documentElement.style;
  root.setProperty('--viewer-font', JSON.stringify(s.fontFamily));
  root.setProperty('--viewer-size', `${s.fontSize}px`);
  root.setProperty('--editor-font', JSON.stringify(s.editorFontFamily));
  root.setProperty('--editor-size', `${s.editorFontSize}px`);
  const theme = resolveTheme(s.theme, darkQuery.matches);
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.body.classList.toggle('theme-light', theme === 'light');
  const font = $<HTMLSelectElement>('font-select');
  if (!Array.from(font.options).some(o => o.value === s.fontFamily)) font.add(new Option(s.fontFamily));
  font.value = s.fontFamily;
  const size = $<HTMLSelectElement>('size-select');
  if (!Array.from(size.options).some(o => o.value === String(s.fontSize))) size.add(new Option(`${s.fontSize}px`, String(s.fontSize)));
  size.value = String(s.fontSize);
  document.querySelectorAll<HTMLElement>('.theme-menu button').forEach(b => b.classList.toggle('active', b.dataset['theme'] === s.theme));
  $('theme-btn').title = `Theme: ${s.theme}`;
}

function updateSettings(partial: Partial<AppSettings>): void {
  settings = normalizeSettings({ ...settings, ...partial });
  saveSettings(settings);
  applySettings(settings);
}

darkQuery.addEventListener('change', () => applySettings(settings));

// ---------------------------------------------------------------- chrome

function hasDoc(): boolean {
  return path !== null || viewer.blocks.length > 0;
}

function updateChrome(): void {
  document.body.classList.toggle('edit', editMode);
  $('welcome').hidden = editMode || hasDoc();
  document.querySelectorAll<HTMLButtonElement>('.needs-doc').forEach(b => (b.disabled = !hasDoc() && !editMode));
  $('edit-btn').classList.toggle('active', editMode);
  $('edit-label').textContent = editMode ? 'View' : 'Edit';
  $('outline').hidden = !outlineOpen;
  $('outline-btn').classList.toggle('active', outlineOpen);
  $('sidebar').hidden = !sidebarOpen;
  $('feedback-btn').classList.toggle('active', sidebarOpen);
}

function toast(text: string, ms = 2500): void {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function refreshOutline(): void {
  if (outlineOpen) renderOutline($('outline-list'), viewer.headings, store.all, i => viewer.scrollToHeading(i));
}

viewer.onOutline = refreshOutline;
store.subscribe(refreshOutline);

function toggleOutline(force?: boolean): void {
  outlineOpen = force ?? !outlineOpen;
  updateChrome();
  refreshOutline();
}

function toggleSidebar(force?: boolean): void {
  sidebarOpen = force ?? !sidebarOpen;
  updateChrome();
  sidebar.render();
}

// ---------------------------------------------------------------- documents

async function loadOpened(o: Opened): Promise<void> {
  path = o.path;
  dirty = false;
  viewer.baseDir = dirname(o.path);
  sidebar.filename = o.name;
  sidebar.selectedId = null;
  const feedback = store.setFile(o.path);
  await viewer.apply(o.blocks, true);
  viewer.scroller.scrollTop = 0;
  updateChrome();
  if (editor) editor.setText(await api.getContent());
  await feedback;
  viewer.applyHighlights();
}

async function openFile(): Promise<void> {
  try {
    const o = await serial(async () => {
      const r = await api.openDialog();
      if (r) await loadOpened(r);
      return r;
    });
    if (!o) return;
  } catch (e) {
    toast(`Could not open file: ${e}`);
  }
}

async function openPath(p: string): Promise<void> {
  try {
    await serial(async () => loadOpened(await api.openPath(p)));
  } catch (e) {
    toast(`Could not open file: ${e}`);
  }
}

async function save(): Promise<void> {
  if (!hasDoc() && !editMode) return;
  if (!path) return saveAs();
  const text = editor && dirty ? editor.getText() : null;
  try {
    if (await api.save(text)) dirty = false;
  } catch (e) {
    toast(`Could not save: ${e}`);
  }
}

async function saveAs(): Promise<void> {
  if (!hasDoc() && !editMode) return;
  const text = editor ? editor.getText() : null;
  try {
    const res = await api.saveAs(text);
    if (!res) return;
    dirty = false;
    path = res.path;
    viewer.baseDir = dirname(res.path);
    sidebar.filename = res.name;
    store.rename(res.path);
    updateChrome();
  } catch (e) {
    toast(`Could not save: ${e}`);
  }
}

function print(): void {
  if (!hasDoc()) return;
  api.print().catch(() => window.print());
}

// ---------------------------------------------------------------- edit mode

let latestText: string | null = null;
let renderRunning = false;

function scheduleRender(text: string): void {
  latestText = text;
  if (renderRunning) return;
  renderRunning = true;
  void serial(async () => {
    try {
      while (latestText !== null) {
        const t = latestText;
        latestText = null;
        const blocks: Block[] = await api.render(t, false);
        await viewer.apply(blocks, false);
      }
    } finally {
      renderRunning = false;
      updateChrome();
    }
  });
}

let syncFrame = 0;
function syncPreview(line: number): void {
  cancelAnimationFrame(syncFrame);
  syncFrame = requestAnimationFrame(() => viewer.scrollToLine(line));
}

async function toggleEdit(): Promise<void> {
  editMode = !editMode;
  viewer.interactive = !editMode;
  viewer.hideSelectionButton();
  closePopover();
  updateChrome();
  if (editMode) {
    if (!editor) {
      const [{ createEditor }, text] = await Promise.all([import('./editor.js'), api.getContent()]);
      editor = createEditor($('editor-pane'), text, t => {
        dirty = true;
        scheduleRender(t);
      }, syncPreview);
    }
    editor.focus();
  }
}

// Split pane divider
{
  const divider = $('divider');
  const main = $('main');
  divider.addEventListener('mousedown', e => {
    e.preventDefault();
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev: MouseEvent) => {
      const r = main.getBoundingClientRect();
      const pct = Math.max(20, Math.min(80, ((ev.clientX - r.left) / r.width) * 100));
      document.body.style.setProperty('--split', `${pct}%`);
    };
    const up = () => {
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

// ---------------------------------------------------------------- external changes

async function reloadFromDisk(): Promise<void> {
  await serial(async () => {
    const blocks = await api.reloadFromDisk();
    await viewer.apply(blocks, false);
    if (editor) editor.setText(await api.getContent());
    dirty = false;
  });
}

async function onFileChanged(): Promise<void> {
  if (dirty) {
    $('conflict').hidden = false;
    return;
  }
  try {
    await reloadFromDisk();
    toast('File reloaded from disk');
  } catch {
    /* nothing pending */
  }
}

$('conflict-disk').addEventListener('click', async () => {
  $('conflict').hidden = true;
  await reloadFromDisk().catch(() => {});
});
$('conflict-keep').addEventListener('click', () => {
  $('conflict').hidden = true;
  api.discardDiskChange();
});

// ---------------------------------------------------------------- feedback popover

const popover = $('popover');
const popoverText = $<HTMLTextAreaElement>('popover-text');
const popoverSave = $<HTMLButtonElement>('popover-save');

viewer.onRequestFeedback = req => {
  const { rect, ...data } = req;
  pendingFeedback = data;
  $('popover-snippet').textContent = `"${data.selectedText.slice(0, 80)}"`;
  const PH = 240;
  const PW = 320;
  const M = 8;
  const fitsBelow = rect.bottom + M + PH <= window.innerHeight - M;
  popover.style.top = `${fitsBelow ? rect.bottom + M : Math.max(M, rect.top - M - PH)}px`;
  popover.style.left = `${Math.min(Math.max(M, rect.left), window.innerWidth - PW - M)}px`;
  popoverText.value = '';
  popoverSave.disabled = true;
  popover.hidden = false;
  setTimeout(() => popoverText.focus(), 0);
};

function closePopover(): void {
  popover.hidden = true;
  pendingFeedback = null;
}

function savePopover(): void {
  const text = popoverText.value.trim();
  if (!pendingFeedback || !text) return;
  store.add({ ...pendingFeedback, feedback: text });
  closePopover();
}

popoverText.addEventListener('input', () => (popoverSave.disabled = !popoverText.value.trim()));
popoverText.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePopover();
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    savePopover();
  }
});
popoverSave.addEventListener('click', savePopover);
$('popover-cancel').addEventListener('click', closePopover);

viewer.onSelectFeedback = id => {
  if (!sidebarOpen) toggleSidebar(true);
  sidebar.select(id);
};
viewer.onOpenPath = p => void openPath(p);

const report = new ReportDialog(api.appVersion, api.openUrl, msg => toast(msg, 6000));
const about = new AboutDialog($('about'), {
  version: api.appVersion,
  openUrl: api.openUrl,
  checkUpdates: api.checkUpdates,
  sendFeedback: () => report.show(),
  notify: msg => toast(msg, 4000)
});

// ---------------------------------------------------------------- toolbar

const actions: Record<string, () => void> = {
  open: () => void openFile(),
  save: () => void save(),
  'save-as': () => void saveAs(),
  print,
  'toggle-edit': () => void toggleEdit(),
  'toggle-outline': () => toggleOutline(),
  'toggle-feedback': () => toggleSidebar(),
  'send-feedback': () => report.show(),
  about: () => void about.show()
};

document.addEventListener('click', e => {
  const el = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (el && actions[el.dataset['action']!]) actions[el.dataset['action']!]();
  const t = (e.target as Element).closest<HTMLElement>('[data-theme]');
  if (t) {
    updateSettings({ theme: t.dataset['theme'] as Theme });
    t.blur();
  }
});
$<HTMLSelectElement>('font-select').addEventListener('change', e => updateSettings({ fontFamily: (e.target as HTMLSelectElement).value }));
$<HTMLSelectElement>('size-select').addEventListener('change', e => updateSettings({ fontSize: Number((e.target as HTMLSelectElement).value) }));
document.addEventListener('mousedown', e => {
  if (!(e.target as Element).closest('#selection-button')) viewer.hideSelectionButton();
});

// ---------------------------------------------------------------- boot

async function boot(): Promise<void> {
  applySettings(settings);
  // Listeners first: the Rust side only forwards OS "open file" events after init.
  await Promise.all([
    api.on<string>('menu', id => {
      const map: Record<string, string> = { open: 'open', save: 'save', save_as: 'save-as', print: 'print', toggle_edit: 'toggle-edit', send_feedback: 'send-feedback', about: 'about', about_app: 'about' };
      actions[map[id]]?.();
    }),
    api.on<string>('open-path', p => void openPath(p)),
    api.on<null>('file-changed', () => void onFileChanged())
  ]);
  try {
    const opened = await api.init();
    if (opened) await serial(() => loadOpened(opened));
    performance.mark('first-content');
  } catch (e) {
    toast(`Could not open file: ${e}`);
  }
  updateChrome();
  requestAnimationFrame(() => void api.ready());
  new UpdatePanel($('update-panel'));
}

void boot();

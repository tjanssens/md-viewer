import { copyText, h } from './dom';
import { REPO, platformName } from './report';

/** "About MD Viewer": version, links and a few handy shortcuts in one place. */

export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;

export const SHORTCUTS: [string, string][] = [
  ['Open file', 'Ctrl+O'],
  ['Save', 'Ctrl+S'],
  ['Toggle edit mode', 'Ctrl+E'],
  ['Print', 'Ctrl+P'],
  ['Zoom in / out / reset', 'Ctrl+= / Ctrl+- / Ctrl+0']
];

/** Plain-text summary for "Copy info", handy when reporting a problem. */
export function aboutText(version: string, platform: string): string {
  return [`MD Viewer ${version}`, `Platform: ${platform}`, REPO_URL].join('\n');
}

/** Shows Cmd instead of Ctrl on macOS. */
export function shortcutLabel(keys: string, platform: string): string {
  return platform === 'macOS' ? keys.replace(/Ctrl\+/g, '⌘') : keys;
}

export interface AboutActions {
  version: () => Promise<string>;
  openUrl: (url: string) => Promise<void>;
  checkUpdates: () => Promise<void>;
  sendFeedback: () => void;
  notify: (msg: string) => void;
}

export class AboutDialog {
  constructor(private readonly overlay: HTMLElement, private readonly act: AboutActions) {
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) this.close();
    });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });
  }

  async show(): Promise<void> {
    let version = 'unknown';
    try {
      version = await this.act.version();
    } catch {
      /* keep "unknown" */
    }
    const platform = platformName();
    const open = (url: string) => () => {
      this.act.openUrl(url).catch(e => this.act.notify(`Could not open the browser: ${e}`));
    };
    const close = h('button', { class: 'btn-secondary', text: 'Close', onclick: () => this.close() });
    const modal = h('div', { class: 'modal about-modal', role: 'dialog', 'aria-labelledby': 'about-heading' },
      h('h2', { id: 'about-heading', text: 'MD Viewer' }),
      h('p', { class: 'about-tagline', text: 'A fast Markdown viewer and editor.' }),
      h('dl', { class: 'about-info' },
        h('dt', { text: 'Version' }), h('dd', { text: version }),
        h('dt', { text: 'Platform' }), h('dd', { text: platform }),
        h('dt', { text: 'License' }), h('dd', { text: 'MIT' })
      ),
      h('div', { class: 'about-buttons' },
        h('button', { class: 'btn-primary', text: 'Check for updates', onclick: () => {
          this.close();
          this.act.checkUpdates().catch(e => this.act.notify(`Update check failed: ${e}`));
        } }),
        h('button', { class: 'btn-secondary', text: 'GitHub', onclick: open(REPO_URL) }),
        h('button', { class: 'btn-secondary', text: 'Release notes', onclick: open(RELEASES_URL) }),
        h('button', { class: 'btn-secondary', text: 'Send feedback', onclick: () => {
          this.close();
          this.act.sendFeedback();
        } }),
        h('button', { class: 'btn-secondary', text: 'Copy info', onclick: () => {
          void copyText(aboutText(version, platform)).then(() => this.act.notify('Version info copied.'));
        } })
      ),
      h('h3', { text: 'Keyboard shortcuts' }),
      h('table', { class: 'about-shortcuts' },
        ...SHORTCUTS.map(([what, keys]) => h('tr', {}, h('td', { text: what }), h('td', {}, h('span', { class: 'kbd', text: shortcutLabel(keys, platform) }))))
      ),
      h('div', { class: 'report-actions' }, close)
    );
    this.overlay.replaceChildren(modal);
    this.overlay.hidden = false;
    close.focus();
  }

  close(): void {
    this.overlay.hidden = true;
  }
}

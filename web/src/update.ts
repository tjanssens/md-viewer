import { h } from './dom';
import { api, UpdateStatus } from './ipc';

export class UpdatePanel {
  private status: UpdateStatus = { state: 'checking' };
  private logs: string[] = [];
  private showLog = false;

  constructor(private root: HTMLElement) {
    api.on<UpdateStatus>('update-status', s => {
      this.status = s;
      this.root.hidden = false;
      this.render();
    });
    api.on<string>('update-log', line => {
      this.logs = [...this.logs, line].slice(-300);
      if (this.showLog && !this.root.hidden) this.render();
    });
    api.updateLogs().then(l => (this.logs = l)).catch(() => {});
  }

  private message(): string {
    const s = this.status;
    const v = s.version ? ` ${s.version}` : '';
    switch (s.state) {
      case 'checking': return 'Checking for updates…';
      case 'downloading': return s.percent !== undefined ? `Downloading update${v}… ${s.percent}%` : `Downloading update${v}…`;
      case 'available': return `Version${v} is available.`;
      case 'downloaded': return `Version${v} has been downloaded and is ready to install.`;
      case 'not-available': return `You're up to date${s.version ? ` (v${s.version})` : ''}.`;
      case 'error': return `Update check failed: ${s.message || 'unknown error'}`;
    }
  }

  private render(): void {
    const s = this.status;
    const icon = { checking: '↻', downloading: '↻', available: '⬆', downloaded: '⬆', 'not-available': '✓', error: '⚠' }[s.state];
    const parts = [
      h('div', { class: 'update-row' },
        h('div', { text: `${icon} ${this.message()}` }),
        h('button', { class: 'close-btn', title: 'Close', text: '×', onclick: () => (this.root.hidden = true) })
      ),
      s.state === 'downloading' && s.percent !== undefined
        ? h('div', { class: 'progress' }, h('div', { class: 'progress-bar', style: `width:${s.percent}%` }))
        : null,
      h('div', { class: 'update-actions' },
        s.state === 'downloaded' ? h('button', { class: 'btn-primary', text: 'Restart & update', onclick: () => api.installUpdate() }) : null,
        s.state === 'available'
          ? h('button', { class: 'btn-primary', text: 'Download', onclick: () => { api.openUrl(s.releaseUrl || 'https://github.com/tjanssens/md-viewer/releases/latest'); this.root.hidden = true; } })
          : null,
        s.state === 'not-available' || s.state === 'error'
          ? h('button', { class: 'btn-secondary', text: 'Check again', onclick: () => api.checkUpdates() })
          : null,
        h('button', { class: 'btn-link', text: this.showLog ? 'Hide details' : 'Details', onclick: () => { this.showLog = !this.showLog; this.render(); } })
      ),
      this.showLog ? h('pre', { class: 'update-log', text: this.logs.length ? this.logs.join('\n') : 'No log output yet.' }) : null
    ];
    this.root.replaceChildren(...parts.filter((p): p is HTMLElement => p !== null));
  }
}

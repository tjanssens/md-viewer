import { $ } from './dom';

/**
 * "Send feedback" turns what the user types into a pre-filled GitHub
 * "new issue" page that opens in their browser. No token ever ships in the
 * app: the user submits the issue with their own GitHub account.
 */

export const REPO = 'tjanssens/md-viewer';
/** Marks issues that came from the app; the feedback workflow looks for it. */
export const MARKER = '<!-- md-viewer-feedback -->';
/** Browsers and GitHub cope with long URLs, but keep a safe margin. */
const MAX_URL = 7000;

export type ReportKind = 'bug' | 'idea';

export interface Report {
  kind: ReportKind;
  title: string;
  text: string;
  version?: string;
  platform?: string;
}

export function issueTitle(r: Report): string {
  const t = r.title.trim() || r.text.trim().split(/\r?\n/)[0] || 'Feedback';
  const short = t.length > 80 ? `${t.slice(0, 77)}…` : t;
  return `[${r.kind === 'bug' ? 'Bug' : 'Idea'}] ${short}`;
}

export function issueBody(r: Report, text = r.text.trim()): string {
  const lines = [text, '', '---', `Type: ${r.kind === 'bug' ? 'bug' : 'idea'}`];
  if (r.version) lines.push(`App version: ${r.version}`);
  if (r.platform) lines.push(`Platform: ${r.platform}`);
  lines.push('', MARKER);
  return lines.join('\n');
}

export function issueUrl(r: Report): string {
  const build = (body: string) => {
    const q = new URLSearchParams({ title: issueTitle(r), body });
    return `https://github.com/${REPO}/issues/new?${q.toString()}`;
  };
  let text = r.text.trim();
  let url = build(issueBody(r, text));
  // Trim the text (not the footer with the marker) until the URL fits.
  while (url.length > MAX_URL && text.length > 0) {
    text = text.slice(0, Math.max(0, text.length - Math.max(50, url.length - MAX_URL)));
    url = build(issueBody(r, `${text}\n\n_(truncated, please paste the rest here)_`));
  }
  return url;
}

export function platformName(ua = navigator.userAgent): string {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'unknown';
}

export class ReportDialog {
  private readonly overlay = $('report');
  private readonly kind = $<HTMLSelectElement>('report-kind');
  private readonly title = $<HTMLInputElement>('report-title');
  private readonly text = $<HTMLTextAreaElement>('report-text');
  private readonly send = $<HTMLButtonElement>('report-send');

  constructor(
    private readonly version: () => Promise<string>,
    private readonly open: (url: string) => Promise<void>,
    private readonly notify: (msg: string) => void
  ) {
    $('report-cancel').addEventListener('click', () => this.close());
    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) this.close();
    });
    this.overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void this.submit();
    });
    this.text.addEventListener('input', () => this.sync());
    this.send.addEventListener('click', () => void this.submit());
  }

  show(): void {
    this.overlay.hidden = false;
    this.sync();
    this.text.focus();
  }

  close(): void {
    this.overlay.hidden = true;
  }

  private sync(): void {
    this.send.disabled = this.text.value.trim().length === 0;
  }

  private async submit(): Promise<void> {
    if (!this.text.value.trim()) return;
    let version: string | undefined;
    try {
      version = await this.version();
    } catch {
      version = undefined;
    }
    const url = issueUrl({
      kind: this.kind.value === 'bug' ? 'bug' : 'idea',
      title: this.title.value,
      text: this.text.value,
      version,
      platform: platformName()
    });
    try {
      await this.open(url);
    } catch (e) {
      this.notify(`Could not open the browser: ${e}`);
      return;
    }
    this.title.value = '';
    this.text.value = '';
    this.close();
    this.notify('GitHub opened in your browser. Click "Create" there to send your feedback.');
  }
}

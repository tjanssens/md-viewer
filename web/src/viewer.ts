import { Block, patchBlocks } from './blocks';
import { api } from './ipc';
import { FeedbackStore } from './feedback/store';
import { findAnchor, resolveStatus, FeedbackItem } from './feedback/model';
import { TextIndex, wrapRange, unwrapAll, headingPathFor } from './textindex';

export interface Heading {
  el: HTMLElement;
  level: number;
  text: string;
}

export interface FeedbackRequest {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  headingPath: string[];
  rect: { top: number; left: number; bottom: number };
}

const HL_CLASS = 'feedback-highlight';
const CODE_CACHE_LIMIT = 1000;

export class Viewer {
  blocks: Block[] = [];
  headings: Heading[] = [];
  /** Folder of the current document, for relative links. */
  baseDir = '';
  /** Selection-to-feedback is only offered in view mode. */
  interactive = true;

  onOutline: (headings: Heading[]) => void = () => {};
  onSelectFeedback: (id: string) => void = () => {};
  onRequestFeedback: (req: FeedbackRequest) => void = () => {};
  onOpenPath: (path: string) => void = () => {};

  private index: TextIndex | null = null;
  private hlScheduled = false;
  private ignoreStoreEcho = false;
  private codeQueue = new Set<HTMLElement>();
  private codeCache = new Map<string, string | null>();
  private codeCssLoaded = false;
  private observer: IntersectionObserver;
  private pending: { selectedText: string; contextBefore: string; contextAfter: string; headingPath: string[] } | null = null;

  constructor(
    readonly scroller: HTMLElement,
    readonly doc: HTMLElement,
    private selectionButton: HTMLElement,
    private store: FeedbackStore
  ) {
    this.observer = new IntersectionObserver(entries => this.onIntersect(entries), {
      root: scroller,
      rootMargin: '1500px 0px'
    });
    store.subscribe(() => {
      if (this.ignoreStoreEcho) return;
      this.scheduleHighlights();
    });
    doc.addEventListener('mouseup', () => setTimeout(() => this.handleSelection(), 0));
    doc.addEventListener('click', e => this.onClick(e));
    scroller.addEventListener('scroll', () => this.hideSelectionButton(), { passive: true });
    selectionButton.addEventListener('mousedown', e => e.preventDefault());
    selectionButton.addEventListener('click', () => this.onFeedbackButton());
  }

  clear(): void {
    this.doc.textContent = '';
    this.blocks = [];
    this.headings = [];
    this.index = null;
    this.onOutline(this.headings);
  }

  /** Apply a render result from Rust. */
  async apply(blocks: Block[], reset: boolean): Promise<void> {
    let res = patchBlocks(this.doc, blocks, reset);
    if (!res.ok) {
      // Out of sync with the Rust side: ask for the full HTML.
      blocks = await api.rerender(true);
      res = patchBlocks(this.doc, blocks, true);
    }
    this.blocks = blocks;
    this.index = null;
    const children = this.doc.children;
    const headings: Heading[] = [];
    blocks.forEach((b, i) => {
      if (b.h) {
        const el = children[i]?.firstElementChild as HTMLElement | null;
        if (el) headings.push({ el, level: b.h, text: b.t ?? '' });
      }
    });
    const outlineChanged =
      headings.length !== this.headings.length ||
      headings.some((h, i) => h.text !== this.headings[i].text || h.level !== this.headings[i].level);
    this.headings = headings;
    if (outlineChanged || reset) this.onOutline(headings);
    // No layout reads here (they would force every block to render). On a fresh
    // document the first blocks are the visible ones; after edits the observer decides.
    res.created.forEach((el, i) => this.prepareCode(el, reset ? i < 60 : false));
    if (this.store.all.length > 0 || this.doc.querySelector('.' + HL_CLASS)) this.applyHighlights();
  }

  // ------------------------------------------------------------ code highlighting

  /** `near`: highlight right away instead of waiting for the observer. */
  private prepareCode(block: HTMLElement, near: boolean): void {
    const codes = block.querySelectorAll<HTMLElement>('pre > code');
    if (codes.length === 0) return;
    for (const code of Array.from(codes)) {
      const lang = /(?:^|\s)language-(\S+)/.exec(code.className)?.[1];
      if (!lang) continue;
      const key = lang + '\u0000' + code.textContent;
      const hit = this.codeCache.get(key);
      if (hit !== undefined) {
        if (hit !== null) code.innerHTML = hit;
        continue;
      }
      // Code near the viewport is highlighted right away; the rest when it scrolls into view.
      if (near) this.codeQueue.add(code);
      else this.observer.observe(code);
    }
    if (this.codeQueue.size > 0) queueMicrotask(() => this.flushCode());
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      this.observer.unobserve(e.target);
      this.codeQueue.add(e.target as HTMLElement);
    }
    if (this.codeQueue.size > 0) queueMicrotask(() => this.flushCode());
  }

  private async flushCode(): Promise<void> {
    const els = Array.from(this.codeQueue).filter(el => el.isConnected);
    this.codeQueue.clear();
    if (els.length === 0) return;
    const items: [string, string][] = els.map(el => [
      /(?:^|\s)language-(\S+)/.exec(el.className)?.[1] ?? '',
      el.textContent ?? ''
    ]);
    if (!this.codeCssLoaded) {
      this.codeCssLoaded = true;
      api.highlightCss().then(css => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
      });
    }
    let results: (string | null)[];
    try {
      results = await api.highlight(items);
    } catch {
      return;
    }
    if (this.codeCache.size > CODE_CACHE_LIMIT) this.codeCache.clear();
    let touched = false;
    els.forEach((el, i) => {
      const [lang, code] = items[i];
      this.codeCache.set(lang + '\u0000' + code, results[i]);
      if (results[i] !== null && el.isConnected && el.textContent === code) {
        el.innerHTML = results[i]!;
        touched = true;
      }
    });
    if (touched) {
      this.index = null;
      if (this.store.all.length > 0) this.scheduleHighlights();
    }
  }

  // ------------------------------------------------------------ feedback highlights

  scheduleHighlights(): void {
    if (this.hlScheduled) return;
    this.hlScheduled = true;
    // setTimeout rather than requestAnimationFrame: rAF does not run while the window is still hidden.
    setTimeout(() => {
      this.hlScheduled = false;
      this.applyHighlights();
    }, 0);
  }

  applyHighlights(): void {
    unwrapAll(this.doc, '.' + HL_CLASS);
    this.index = null;
    const items = this.store.all;
    if (items.length === 0 || this.blocks.length === 0) return;

    const index = new TextIndex(this.doc);
    const updates = new Map<string, Partial<FeedbackItem>>();
    const ranges: { start: number; end: number; item: FeedbackItem }[] = [];
    for (const item of items) {
      const match = findAnchor(item, index.text);
      const { status, shifted } = resolveStatus(item, match);
      if (status !== item.status || !!shifted !== !!item.shifted) updates.set(item.id, { status, shifted });
      if (match.matchType !== 'none') ranges.push({ start: match.startIndex, end: match.endIndex, item: { ...item, status } });
    }
    ranges.sort((a, b) => b.start - a.start);
    let limit = Infinity;
    for (const r of ranges) {
      const end = Math.min(r.end, limit);
      if (end > r.start) {
        wrapRange(index, r.start, end, () => {
          const span = document.createElement('span');
          span.className = HL_CLASS + (r.item.status === 'processed' ? ' processed' : '');
          span.dataset['feedbackId'] = r.item.id;
          return span;
        });
      }
      limit = Math.min(limit, r.start);
    }

    if (updates.size > 0) {
      this.ignoreStoreEcho = true;
      try {
        this.store.replaceAll(items.map(i => (updates.has(i.id) ? { ...i, ...updates.get(i.id) } : i)));
      } finally {
        this.ignoreStoreEcho = false;
      }
    }
  }

  scrollToFeedback(id: string): void {
    const el = this.doc.querySelector<HTMLElement>(`[data-feedback-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const all = this.doc.querySelectorAll<HTMLElement>(`[data-feedback-id="${CSS.escape(id)}"]`);
    all.forEach(s => s.classList.add('flash'));
    setTimeout(() => all.forEach(s => s.classList.remove('flash')), 1200);
  }

  scrollToHeading(i: number): void {
    const h = this.headings[i];
    if (!h) return;
    h.el.scrollIntoView({ block: 'start' });
    // Off-screen blocks have estimated sizes; settle once they are laid out.
    requestAnimationFrame(() => h.el.scrollIntoView({ block: 'start' }));
  }

  /** Scroll so that source line `line` (1-based, fractional) is at the top. */
  scrollToLine(line: number): void {
    const blocks = this.blocks;
    if (blocks.length === 0) return;
    let i = 0;
    let lo = 0;
    let hi = blocks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (blocks[mid].line <= line) {
        i = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const el = this.doc.children[i] as HTMLElement | undefined;
    if (!el) return;
    const next = this.doc.children[i + 1] as HTMLElement | undefined;
    const startLine = blocks[i].line;
    const endLine = blocks[i + 1]?.line ?? startLine + 1;
    const frac = Math.min(1, Math.max(0, (line - startLine) / Math.max(1, endLine - startLine)));
    const top = el.offsetTop;
    const bottom = next ? next.offsetTop : top + el.offsetHeight;
    this.scroller.scrollTop = top + (bottom - top) * frac - 16;
  }

  // ------------------------------------------------------------ selection -> feedback

  private handleSelection(): void {
    const sel = window.getSelection();
    if (!this.interactive || !sel || sel.isCollapsed || sel.rangeCount === 0) return this.hideSelectionButton();
    const range = sel.getRangeAt(0);
    if (!this.doc.contains(range.commonAncestorContainer)) return this.hideSelectionButton();

    if (!this.index) this.index = new TextIndex(this.doc);
    const text = this.index.text;
    let start = this.index.offsetOf(range.startContainer, range.startOffset);
    let end = this.index.offsetOf(range.endContainer, range.endOffset);
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    const selectedText = text.slice(start, end);
    if (!selectedText) return this.hideSelectionButton();

    this.pending = {
      selectedText,
      contextBefore: text.slice(Math.max(0, start - 50), start),
      contextAfter: text.slice(end, end + 50),
      headingPath: headingPathFor(range.startContainer, this.headings.map(h => h.el))
    };
    const rect = range.getBoundingClientRect();
    const W = 160;
    const H = 32;
    const M = 8;
    const top = rect.top - H - M;
    const btn = this.selectionButton;
    btn.style.top = `${top >= M ? top : rect.bottom + M}px`;
    btn.style.left = `${Math.min(Math.max(M, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - M)}px`;
    btn.hidden = false;
  }

  hideSelectionButton(): void {
    this.selectionButton.hidden = true;
    this.pending = null;
  }

  private onFeedbackButton(): void {
    const sel = window.getSelection();
    if (!this.pending || !sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.onRequestFeedback({ ...this.pending, rect: { top: rect.top, left: rect.left, bottom: rect.bottom } });
    this.hideSelectionButton();
    sel.removeAllRanges();
  }

  // ------------------------------------------------------------ clicks and links

  private onClick(e: MouseEvent): void {
    const target = e.target as Element;
    const hl = target.closest<HTMLElement>('.' + HL_CLASS);
    if (hl?.dataset['feedbackId']) {
      this.onSelectFeedback(hl.dataset['feedbackId']);
    }
    const a = target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const el = document.getElementById(id) ?? this.doc.querySelector(`[name="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ block: 'start' });
      return;
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      api.openUrl(href).catch(() => {});
      return;
    }
    // Relative link to another Markdown file: open it here.
    const file = href.split('#')[0];
    if (/\.(md|markdown|mdown)$/i.test(file) && !/^[a-z][a-z0-9+.-]*:/i.test(file) && this.baseDir) {
      this.onOpenPath(joinPath(this.baseDir, decodeURIComponent(file)));
    }
  }
}

export function joinPath(dir: string, rel: string): string {
  if (/^([a-zA-Z]:[\\/]|\/)/.test(rel)) return rel;
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  const parts = dir.split(/[\\/]/);
  for (const p of rel.split(/[\\/]/)) {
    if (p === '' || p === '.') continue;
    if (p === '..') parts.length > 1 && parts.pop();
    else parts.push(p);
  }
  return parts.join(sep);
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return i >= 0 ? path.slice(0, i) : '';
}

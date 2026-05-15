import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, Output, EventEmitter, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownService } from '../../services/markdown.service';
import { SettingsService } from '../../services/settings.service';
import { FeedbackService, FeedbackItem } from '../../services/feedback.service';
import { findAnchor, resolveStatus } from '../../services/feedback-anchor.util';
import { getHeadingPath } from '../../services/heading-path.util';

@Component({
  selector: 'app-markdown-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #viewer
      class="markdown-viewer"
      [style.fontFamily]="fontFamily"
      [style.fontSize.px]="fontSize"
      (mouseup)="onMouseUp()"
      [innerHTML]="renderedContent">
    </div>
    <button
      *ngIf="showSelectionButton"
      class="selection-button"
      [style.top.px]="selectionButtonTop"
      [style.left.px]="selectionButtonLeft"
      (mousedown)="$event.preventDefault()"
      (click)="onFeedbackButtonClick()">
      💬 Feedback toevoegen
    </button>
  `,
  styles: [`
    .markdown-viewer {
      height: 100%;
      overflow-y: auto;
      padding: 32px 48px;
      line-height: 1.7;
      color: var(--color-text);
      background: var(--color-bg);
    }

    :host ::ng-deep h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 0.67em 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-heading);
    }

    :host ::ng-deep h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 1em 0 0.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-heading);
    }

    :host ::ng-deep h3, :host ::ng-deep h4, :host ::ng-deep h5, :host ::ng-deep h6 {
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--color-heading);
    }

    :host ::ng-deep h3 { font-size: 1.25em; }

    :host ::ng-deep p {
      margin: 0 0 16px;
    }

    :host ::ng-deep a {
      color: var(--color-link);
      text-decoration: none;
    }

    :host ::ng-deep a:hover {
      text-decoration: underline;
    }

    :host ::ng-deep code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      background-color: var(--color-code-bg);
      border-radius: 3px;
    }

    :host ::ng-deep pre {
      background-color: var(--color-pre-bg);
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin: 0 0 16px;
    }

    :host ::ng-deep pre code {
      background: none;
      padding: 0;
      font-size: 0.875em;
      line-height: 1.45;
    }

    :host ::ng-deep blockquote {
      margin: 0 0 16px;
      padding: 0 1em;
      color: var(--color-blockquote);
      border-left: 4px solid var(--color-border-strong);
    }

    :host ::ng-deep ul, :host ::ng-deep ol {
      margin: 0 0 16px;
      padding-left: 2em;
    }

    :host ::ng-deep li {
      margin: 0.25em 0;
    }

    :host ::ng-deep table {
      border-collapse: collapse;
      margin: 0 0 16px;
      width: 100%;
    }

    :host ::ng-deep th, :host ::ng-deep td {
      border: 1px solid var(--color-border-strong);
      padding: 8px 12px;
    }

    :host ::ng-deep th {
      background-color: var(--color-bg-elevated);
      font-weight: 600;
    }

    :host ::ng-deep tr:nth-child(even) {
      background-color: var(--color-table-stripe);
    }

    :host ::ng-deep img {
      max-width: 100%;
      height: auto;
    }

    :host ::ng-deep hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 24px 0;
    }

    :host ::ng-deep .hljs {
      background: transparent;
    }

    :host ::ng-deep .feedback-highlight {
      background-color: var(--color-feedback-highlight);
      border-radius: 2px;
      padding: 0 2px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    :host ::ng-deep .feedback-highlight.processed {
      background-color: var(--color-feedback-highlight-processed);
      text-decoration: line-through;
      opacity: 0.7;
    }

    :host ::ng-deep .feedback-highlight.flash {
      background-color: var(--color-feedback-highlight-flash);
    }

    .selection-button {
      position: fixed;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      z-index: 999;
      white-space: nowrap;
    }
    .selection-button:hover {
      background: var(--color-primary-hover);
    }
  `]
})
export class MarkdownViewerComponent implements OnChanges, AfterViewChecked {
  @Input() content = '';
  @Input() scrollPercent = 0;
  @ViewChild('viewer') viewerRef!: ElementRef<HTMLDivElement>;

  renderedContent = '';
  fontFamily = 'Georgia';
  fontSize = 16;

  private needsHighlightApply = false;

  @Output() requestFeedback = new EventEmitter<{
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
    rect: { top: number; left: number; bottom: number };
  }>();

  showSelectionButton = false;
  selectionButtonTop = 0;
  selectionButtonLeft = 0;

  private pendingSelection: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
  } | null = null;

  constructor(
    private markdownService: MarkdownService,
    private settingsService: SettingsService,
    private feedbackService: FeedbackService
  ) {
    this.settingsService.settings$.subscribe(settings => {
      this.fontFamily = settings.fontFamily;
      this.fontSize = settings.fontSize;
    });
    this.feedbackService.items$.subscribe(() => {
      queueMicrotask(() => this.applyHighlights());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.renderedContent = this.markdownService.parse(this.content);
      this.needsHighlightApply = true;
    }

    if (changes['scrollPercent'] && this.viewerRef) {
      this.syncScroll(this.scrollPercent);
    }
  }

  ngAfterViewChecked(): void {
    if (this.needsHighlightApply) {
      this.needsHighlightApply = false;
      this.applyHighlights();
    }
  }

  syncScroll(percent: number): void {
    if (this.viewerRef?.nativeElement) {
      const element = this.viewerRef.nativeElement;
      const maxScroll = element.scrollHeight - element.clientHeight;
      element.scrollTop = maxScroll * percent;
    }
  }

  getScrollPercent(): number {
    if (this.viewerRef?.nativeElement) {
      const element = this.viewerRef.nativeElement;
      const maxScroll = element.scrollHeight - element.clientHeight;
      return maxScroll > 0 ? element.scrollTop / maxScroll : 0;
    }
    return 0;
  }

  onMouseUp(): void {
    setTimeout(() => this.handleSelection(), 0);
  }

  private handleSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !this.viewerRef) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }
    const range = selection.getRangeAt(0);
    const root = this.viewerRef.nativeElement;
    if (!root.contains(range.commonAncestorContainer)) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }

    const selectedText = selection.toString();
    if (selectedText.trim().length === 0) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }

    const rootText = root.textContent || '';
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(root);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const beforeText = beforeRange.toString();
    const selectionStart = beforeText.length;

    const contextBefore = rootText.slice(Math.max(0, selectionStart - 50), selectionStart);
    const contextAfter = rootText.slice(
      selectionStart + selectedText.length,
      selectionStart + selectedText.length + 50
    );
    const headingPath = getHeadingPath(range.startContainer, root);

    this.pendingSelection = { selectedText, contextBefore, contextAfter, headingPath };

    const rect = range.getBoundingClientRect();
    this.selectionButtonTop = rect.top - 40;
    this.selectionButtonLeft = rect.left + rect.width / 2 - 80;
    this.showSelectionButton = true;
  }

  onFeedbackButtonClick(): void {
    if (!this.pendingSelection) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.requestFeedback.emit({
      ...this.pendingSelection,
      rect: { top: rect.top, left: rect.left, bottom: rect.bottom }
    });
    this.showSelectionButton = false;
    this.pendingSelection = null;
    sel.removeAllRanges();
  }

  hideSelectionButton(): void {
    this.showSelectionButton = false;
    this.pendingSelection = null;
  }

  private applyHighlights(): void {
    if (!this.viewerRef) return;
    const root = this.viewerRef.nativeElement;

    root.querySelectorAll('.feedback-highlight').forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    root.normalize();

    const items = this.feedbackService.getItems();
    const text = root.textContent || '';
    const statusUpdates: { id: string; status: any; shifted: boolean }[] = [];

    for (const item of items) {
      const match = findAnchor(item, text);
      const { status, shifted } = resolveStatus(item, match);
      if (status !== item.status || !!shifted !== !!item.shifted) {
        statusUpdates.push({ id: item.id, status, shifted });
      }
      if (match.matchType !== 'none') {
        this.wrapRange(root, match.startIndex, match.endIndex, item);
      }
    }

    if (statusUpdates.length > 0) {
      for (const upd of statusUpdates) {
        this.feedbackService.update(upd.id, { status: upd.status, shifted: upd.shifted });
      }
    }
  }

  private wrapRange(root: HTMLElement, start: number, end: number, item: FeedbackItem): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let offset = 0;
    let startNode: Text | null = null;
    let startOffsetInNode = 0;
    let endNode: Text | null = null;
    let endOffsetInNode = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const length = node.data.length;
      if (!startNode && offset + length > start) {
        startNode = node;
        startOffsetInNode = start - offset;
      }
      if (!endNode && offset + length >= end) {
        endNode = node;
        endOffsetInNode = end - offset;
        break;
      }
      offset += length;
    }

    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffsetInNode);
      range.setEnd(endNode, endOffsetInNode);
      const span = document.createElement('span');
      span.className = 'feedback-highlight' + (item.status === 'processed' ? ' processed' : '');
      span.setAttribute('data-feedback-id', item.id);
      try {
        range.surroundContents(span);
      } catch {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
    } catch (error) {
      console.warn('Could not wrap highlight for item', item.id, error);
    }
  }

  scrollToFeedback(id: string): void {
    if (!this.viewerRef) return;
    const el = this.viewerRef.nativeElement.querySelector(`[data-feedback-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
  }
}

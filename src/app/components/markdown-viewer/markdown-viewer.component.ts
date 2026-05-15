import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownService } from '../../services/markdown.service';
import { SettingsService } from '../../services/settings.service';

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
      [innerHTML]="renderedContent">
    </div>
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
  `]
})
export class MarkdownViewerComponent implements OnChanges {
  @Input() content = '';
  @Input() scrollPercent = 0;
  @ViewChild('viewer') viewerRef!: ElementRef<HTMLDivElement>;

  renderedContent = '';
  fontFamily = 'Georgia';
  fontSize = 16;

  constructor(
    private markdownService: MarkdownService,
    private settingsService: SettingsService
  ) {
    this.settingsService.settings$.subscribe(settings => {
      this.fontFamily = settings.fontFamily;
      this.fontSize = settings.fontSize;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.renderedContent = this.markdownService.parse(this.content);
    }

    if (changes['scrollPercent'] && this.viewerRef) {
      this.syncScroll(this.scrollPercent);
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
}

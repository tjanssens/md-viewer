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
      color: #24292e;
    }

    :host ::ng-deep h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 0.67em 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #eaecef;
    }

    :host ::ng-deep h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 1em 0 0.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #eaecef;
    }

    :host ::ng-deep h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin: 1em 0 0.5em;
    }

    :host ::ng-deep h4, :host ::ng-deep h5, :host ::ng-deep h6 {
      font-weight: 600;
      margin: 1em 0 0.5em;
    }

    :host ::ng-deep p {
      margin: 0 0 16px;
    }

    :host ::ng-deep a {
      color: #0366d6;
      text-decoration: none;
    }

    :host ::ng-deep a:hover {
      text-decoration: underline;
    }

    :host ::ng-deep code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
    }

    :host ::ng-deep pre {
      background-color: #f6f8fa;
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
      color: #6a737d;
      border-left: 4px solid #dfe2e5;
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
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
    }

    :host ::ng-deep th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    :host ::ng-deep tr:nth-child(even) {
      background-color: #f6f8fa;
    }

    :host ::ng-deep img {
      max-width: 100%;
      height: auto;
    }

    :host ::ng-deep hr {
      border: none;
      border-top: 1px solid #eaecef;
      margin: 24px 0;
    }

    /* Highlight.js code styling */
    :host ::ng-deep .hljs {
      background: transparent;
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

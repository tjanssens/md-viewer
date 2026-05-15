import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="editor-container">
      <div class="editor-header">
        <span class="editor-title">Markdown Editor</span>
        <span class="line-info">Line {{ currentLine }} of {{ totalLines }}</span>
      </div>
      <textarea
        #editor
        class="editor-textarea"
        [value]="content"
        (input)="onInput($event)"
        (scroll)="onScroll($event)"
        (keyup)="updateLineInfo($event)"
        (click)="updateLineInfo($event)"
        [style.fontFamily]="editorFontFamily"
        [style.fontSize.px]="editorFontSize"
        placeholder="Start typing your markdown here..."
        spellcheck="false">
      </textarea>
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-bg);
    }

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: var(--color-bg-elevated);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .editor-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .line-info {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .editor-textarea {
      flex: 1;
      width: 100%;
      padding: 16px;
      border: none;
      outline: none;
      resize: none;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      tab-size: 2;
    }

    .editor-textarea::placeholder {
      color: var(--color-text-subtle);
    }

    .editor-textarea::-webkit-scrollbar {
      width: 14px;
    }

    .editor-textarea::-webkit-scrollbar-track {
      background: var(--color-bg);
    }

    .editor-textarea::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border: 3px solid var(--color-bg);
      border-radius: 7px;
    }

    .editor-textarea::-webkit-scrollbar-thumb:hover {
      background: var(--color-border-strong);
    }
  `]
})
export class MarkdownEditorComponent implements OnChanges, AfterViewInit {
  @Input() content = '';
  @Output() contentChange = new EventEmitter<string>();
  @Output() scrollChange = new EventEmitter<number>();
  @ViewChild('editor') editorRef!: ElementRef<HTMLTextAreaElement>;

  currentLine = 1;
  totalLines = 1;
  editorFontFamily = 'Consolas';
  editorFontSize = 14;

  constructor(private settingsService: SettingsService) {
    this.settingsService.settings$.subscribe(settings => {
      this.editorFontFamily = settings.editorFontFamily;
      this.editorFontSize = settings.editorFontSize;
    });
  }

  ngAfterViewInit(): void {
    this.updateLineCount();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.updateLineCount();
    }
  }

  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.contentChange.emit(textarea.value);
    this.updateLineCount();
    this.updateLineInfo(event);
  }

  onScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const maxScroll = textarea.scrollHeight - textarea.clientHeight;
    const percent = maxScroll > 0 ? textarea.scrollTop / maxScroll : 0;
    this.scrollChange.emit(percent);
  }

  updateLineInfo(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const text = textarea.value.substring(0, textarea.selectionStart);
    this.currentLine = text.split('\n').length;
  }

  updateLineCount(): void {
    this.totalLines = this.content ? this.content.split('\n').length : 1;
  }

  setContent(newContent: string): void {
    if (this.editorRef?.nativeElement) {
      this.editorRef.nativeElement.value = newContent;
    }
  }

  focus(): void {
    if (this.editorRef?.nativeElement) {
      this.editorRef.nativeElement.focus();
    }
  }
}

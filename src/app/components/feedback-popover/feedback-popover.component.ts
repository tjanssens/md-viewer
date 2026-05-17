import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-feedback-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="popover" [style.top.px]="top" [style.left.px]="left">
      <div class="popover-snippet">"{{ snippet }}"</div>
      <textarea
        #ta
        [(ngModel)]="text"
        placeholder="Write your feedback… (Enter to save, Shift+Enter for new line)"
        rows="4"
        (keydown)="onKeydown($event)">
      </textarea>
      <div class="popover-actions">
        <button class="btn-cancel" (click)="onCancel()">Cancel</button>
        <button class="btn-save" (click)="onSave()" [disabled]="!text.trim()">
          Save <span class="kbd">Enter</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .popover {
      position: fixed;
      width: 320px;
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      padding: 12px;
      z-index: 1000;
    }
    .popover-snippet {
      font-style: italic;
      color: var(--color-text-muted);
      font-size: 12px;
      margin-bottom: 8px;
      max-height: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 8px;
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }
    .popover-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
    }
    button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      cursor: pointer;
      font-size: 14px;
      background: var(--color-bg);
      color: var(--color-text);
    }
    button:hover:not(:disabled) {
      background: var(--color-bg-elevated);
    }
    .btn-save {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-save:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .kbd {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
      background: rgba(255, 255, 255, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 3px;
      vertical-align: middle;
    }
  `]
})
export class FeedbackPopoverComponent implements AfterViewInit {
  @Input() top = 0;
  @Input() left = 0;
  @Input() snippet = '';
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('ta') textareaRef!: ElementRef<HTMLTextAreaElement>;

  text = '';

  ngAfterViewInit(): void {
    setTimeout(() => this.textareaRef.nativeElement.focus(), 0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSave();
    }
  }

  onSave(): void {
    if (!this.text.trim()) return;
    this.save.emit(this.text.trim());
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

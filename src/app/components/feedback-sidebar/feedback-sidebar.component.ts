import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackService, FeedbackItem } from '../../services/feedback.service';
import { CurrentFileService } from '../../services/current-file.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-feedback-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="sidebar" *ngIf="(items$ | async) as items">
      <header class="sidebar-header">
        <h3>Feedback ({{ items.length }})</h3>
        <button class="close-btn" (click)="close.emit()" title="Close">✕</button>
      </header>

      <div class="actions">
        <button class="copy-btn" (click)="onCopy()" [disabled]="!hasOpen(items)">
          📋 Copy all feedback
        </button>
        <div class="bulk-actions">
          <button (click)="onRemoveProcessed()" [disabled]="!hasStatus(items, 'processed')">
            Remove processed
          </button>
          <button (click)="onRemoveOrphaned()" [disabled]="!hasStatus(items, 'orphaned')">
            Remove orphaned
          </button>
        </div>
      </div>

      <div class="items" #itemsContainer>
        <div
          *ngFor="let item of items"
          class="item"
          [attr.data-item-id]="item.id"
          [class.processed]="item.status === 'processed'"
          [class.orphaned]="item.status === 'orphaned'"
          [class.selected]="item.id === selectedId"
          (click)="onItemClick(item)">

          <div class="item-header">
            <span class="item-path" *ngIf="item.headingPath.length > 0">
              {{ item.headingPath.join(' › ') }}
            </span>
            <span class="item-actions" *ngIf="editingState?.id !== item.id">
              <button
                class="edit-btn"
                (click)="startEdit(item, $event)"
                title="Edit">✏️</button>
              <button
                class="status-btn"
                *ngIf="item.status !== 'processed'"
                (click)="$event.stopPropagation(); markProcessed(item)"
                title="Mark as processed">✓</button>
              <button
                class="status-btn"
                *ngIf="item.status === 'processed'"
                (click)="$event.stopPropagation(); markOpen(item)"
                title="Mark as open">↺</button>
              <button
                class="delete-btn"
                (click)="$event.stopPropagation(); remove(item)"
                title="Delete">🗑️</button>
            </span>
          </div>

          <div class="item-snippet">"{{ item.selectedText | slice:0:60 }}{{ item.selectedText.length > 60 ? '…' : '' }}"</div>
          <div class="item-feedback" *ngIf="editingState?.id !== item.id">{{ item.feedback }}</div>
          <div class="edit-block" *ngIf="editingState?.id === item.id && editingState as edit" (click)="$event.stopPropagation()">
            <textarea
              [(ngModel)]="edit.text"
              (keydown)="onEditKeydown($event, item)"
              rows="4"
              placeholder="Feedback…">
            </textarea>
            <div class="edit-actions">
              <button class="btn-cancel" (click)="cancelEdit()">Cancel</button>
              <button class="btn-save" (click)="saveEdit(item)" [disabled]="!edit.text.trim()">Save</button>
            </div>
          </div>

          <div class="item-badges">
            <span class="badge shifted" *ngIf="item.shifted && item.status !== 'orphaned'">📍 shifted</span>
            <span class="badge orphaned" *ngIf="item.status === 'orphaned'">⚠️ not found</span>
            <span class="badge processed" *ngIf="item.status === 'processed'">✓ processed</span>
          </div>
        </div>

        <div class="empty" *ngIf="items.length === 0">
          No feedback yet. Select text in the viewer and click "💬 Add feedback".
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 360px;
      height: 100%;
      background: var(--color-bg-elevated);
      border-left: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      color: var(--color-text);
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .sidebar-header h3 {
      margin: 0;
      font-size: 16px;
      color: var(--color-heading);
    }
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--color-text);
    }
    .actions {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .copy-btn {
      padding: 8px 12px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .copy-btn:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .copy-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bulk-actions {
      display: flex;
      gap: 8px;
    }
    .bulk-actions button {
      flex: 1;
      padding: 6px 8px;
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .bulk-actions button:hover:not(:disabled) {
      background: var(--color-bg-elevated);
    }
    .bulk-actions button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .items {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .item {
      padding: 10px 12px;
      margin-bottom: 8px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      cursor: pointer;
    }
    .item:hover {
      border-color: var(--color-primary);
    }
    .item.selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary);
    }
    .item.processed {
      opacity: 0.6;
    }
    .item.orphaned {
      border-color: var(--color-toast-border);
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }
    .item-path {
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .item-actions {
      display: flex;
      gap: 4px;
    }
    .item-actions button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
      color: var(--color-text);
    }
    .item-actions button:hover {
      background: var(--color-bg-elevated);
      border-radius: 3px;
    }
    .item-snippet {
      font-size: 12px;
      font-style: italic;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }
    .item-feedback {
      font-size: 14px;
      color: var(--color-text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .item-badges {
      margin-top: 8px;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--color-bg-elevated);
      color: var(--color-text-muted);
    }
    .badge.orphaned {
      background: var(--color-toast-bg);
      color: var(--color-toast-text);
    }
    .badge.shifted {
      background: var(--color-bg-elevated);
    }
    .badge.processed {
      background: var(--color-bg-elevated);
    }
    .empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--color-text-muted);
      font-size: 13px;
    }
    .edit-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
      color: var(--color-text);
    }
    .edit-btn:hover {
      background: var(--color-bg-elevated);
      border-radius: 3px;
    }
    .edit-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .edit-block textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 6px;
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
    }
    .edit-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    .edit-actions button {
      padding: 4px 10px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-bg);
      color: var(--color-text);
      cursor: pointer;
      font-size: 12px;
    }
    .edit-actions .btn-save {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .edit-actions .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class FeedbackSidebarComponent implements OnChanges, AfterViewInit {
  @Input() selectedId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() scrollTo = new EventEmitter<string>();

  @ViewChild('itemsContainer') itemsContainer?: ElementRef<HTMLDivElement>;

  items$: Observable<FeedbackItem[]>;

  editingState: { id: string; text: string } | null = null;

  constructor(
    private feedbackService: FeedbackService,
    private currentFileService: CurrentFileService
  ) {
    this.items$ = this.feedbackService.items$;
  }

  ngAfterViewInit(): void {
    if (this.selectedId) this.scrollToSelected();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] && this.selectedId) {
      setTimeout(() => this.scrollToSelected(), 0);
    }
  }

  private scrollToSelected(): void {
    if (!this.itemsContainer || !this.selectedId) return;
    const el = this.itemsContainer.nativeElement.querySelector(
      `[data-item-id="${this.selectedId}"]`
    ) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  hasOpen(items: FeedbackItem[]): boolean {
    return items.some(i => i.status === 'open');
  }

  hasStatus(items: FeedbackItem[], status: string): boolean {
    return items.some(i => i.status === status);
  }

  onItemClick(item: FeedbackItem): void {
    if (item.status === 'orphaned') return;
    this.scrollTo.emit(item.id);
  }

  markProcessed(item: FeedbackItem): void {
    this.feedbackService.update(item.id, { status: 'processed' });
  }

  markOpen(item: FeedbackItem): void {
    this.feedbackService.update(item.id, { status: 'open' });
  }

  startEdit(item: FeedbackItem, event: MouseEvent): void {
    event.stopPropagation();
    this.editingState = { id: item.id, text: item.feedback };
  }

  saveEdit(item: FeedbackItem): void {
    if (!this.editingState) return;
    const text = this.editingState.text.trim();
    if (text) {
      this.feedbackService.update(item.id, { feedback: text });
    }
    this.editingState = null;
  }

  cancelEdit(): void {
    this.editingState = null;
  }

  onEditKeydown(event: KeyboardEvent, item: FeedbackItem): void {
    if (event.key === 'Escape') {
      this.cancelEdit();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      this.saveEdit(item);
    }
  }

  remove(item: FeedbackItem): void {
    this.feedbackService.remove(item.id);
  }

  onRemoveProcessed(): void {
    this.feedbackService.removeByStatus('processed');
  }

  onRemoveOrphaned(): void {
    this.feedbackService.removeByStatus('orphaned');
  }

  onCopy(): void {
    const items = this.feedbackService.getItems().filter(i => i.status === 'open');
    if (items.length === 0) return;

    const filename = this.getCurrentFilename();
    const lines: string[] = [`# Feedback on \`${filename}\`\n`];
    items.forEach((item, idx) => {
      lines.push(`## Feedback ${idx + 1}`);
      if (item.headingPath.length > 0) {
        lines.push(`**Location:** ${item.headingPath.join(' › ')}`);
      }
      lines.push(`**Selected text:**`);
      lines.push(`> ${item.selectedText.replace(/\n/g, '\n> ')}`);
      lines.push('');
      lines.push(`**Feedback:**`);
      lines.push(item.feedback);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(err =>
      console.error('Clipboard write failed:', err)
    );
  }

  private getCurrentFilename(): string {
    return this.currentFileService.getFilename();
  }
}

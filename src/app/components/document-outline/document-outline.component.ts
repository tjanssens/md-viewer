import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FeedbackService, FeedbackItem } from '../../services/feedback.service';
import { OutlineHeading } from '../markdown-viewer/markdown-viewer.component';

interface OutlineRow extends OutlineHeading {
  feedbackCount: number;
}

@Component({
  selector: 'app-document-outline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="outline">
      <header class="outline-header">
        <h3>Outline</h3>
        <button class="close-btn" (click)="close.emit()" title="Close">✕</button>
      </header>
      <div class="outline-list">
        <button
          *ngFor="let row of rows"
          class="outline-item"
          [class.level-1]="row.level === 1"
          [class.level-2]="row.level === 2"
          [class.level-3]="row.level === 3"
          [class.level-4]="row.level === 4"
          [class.level-5]="row.level === 5"
          [class.level-6]="row.level === 6"
          [style.paddingLeft.px]="(row.level - 1) * 12 + 12"
          (click)="select.emit(row.id)"
          [title]="row.text">
          <span class="outline-text">{{ row.text }}</span>
          <span class="feedback-badge" *ngIf="row.feedbackCount > 0" title="Feedback present">
            💬 {{ row.feedbackCount }}
          </span>
        </button>
        <div class="empty" *ngIf="rows.length === 0">
          No headings in this document.
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .outline {
      width: 280px;
      height: 100%;
      background: var(--color-bg-elevated);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      color: var(--color-text);
    }
    .outline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .outline-header h3 {
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
    .outline-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .outline-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      padding: 6px 12px;
      border: none;
      background: none;
      color: var(--color-text);
      text-align: left;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.4;
    }
    .outline-item:hover {
      background: var(--color-bg);
    }
    .outline-item.level-1 {
      font-weight: 600;
      font-size: 14px;
    }
    .outline-item.level-2 {
      font-weight: 500;
    }
    .outline-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .feedback-badge {
      flex-shrink: 0;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--color-feedback-highlight);
      color: var(--color-text);
    }
    .empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--color-text-muted);
      font-size: 13px;
    }
  `]
})
export class DocumentOutlineComponent implements OnInit {
  @Input() outline$!: Observable<OutlineHeading[]>;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  rows: OutlineRow[] = [];
  private destroyRef = inject(DestroyRef);

  constructor(private feedbackService: FeedbackService) {}

  ngOnInit(): void {
    combineLatest([
      this.outline$,
      this.feedbackService.items$
    ]).pipe(
      map(([outline, items]) => this.buildRows(outline, items)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(rows => this.rows = rows);
  }

  private buildRows(outline: OutlineHeading[], items: FeedbackItem[]): OutlineRow[] {
    const countsByHeading = new Map<string, number>();
    for (const item of items) {
      if (item.status === 'orphaned') continue;
      for (const heading of item.headingPath) {
        countsByHeading.set(heading, (countsByHeading.get(heading) ?? 0) + 1);
      }
    }
    return outline.map(h => ({
      ...h,
      feedbackCount: countsByHeading.get(h.text) ?? 0
    }));
  }
}

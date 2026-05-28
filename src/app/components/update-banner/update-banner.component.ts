import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="update-banner">
      <div class="update-message">
        <span class="update-icon">⬆</span>
        <ng-container *ngIf="mode === 'downloaded'">
          Version {{ version }} has been downloaded and is ready to install.
        </ng-container>
        <ng-container *ngIf="mode === 'available'">
          Version {{ version }} is available.
        </ng-container>
      </div>
      <div class="update-actions">
        <button class="btn-primary" (click)="action.emit()">
          {{ mode === 'downloaded' ? 'Restart & update' : 'Download' }}
        </button>
        <button class="btn-secondary" (click)="dismiss.emit()">Later</button>
      </div>
    </div>
  `,
  styles: [`
    .update-banner {
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--color-toast-bg);
      color: var(--color-toast-text);
      border: 1px solid var(--color-toast-border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 2000;
    }
    .update-message {
      font-size: 14px;
    }
    .update-icon {
      margin-right: 6px;
      font-weight: bold;
    }
    .update-actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      border: 1px solid var(--color-toast-border);
    }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-primary:hover {
      background: var(--color-primary-hover);
    }
    .btn-secondary {
      background: transparent;
      color: var(--color-toast-text);
    }
    .btn-secondary:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  `]
})
export class UpdateBannerComponent {
  @Input() version = '';
  @Input() mode: 'available' | 'downloaded' = 'available';
  @Output() action = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
}

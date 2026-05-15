import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reload-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast">
      <div class="toast-message">
        <span class="toast-icon">↻</span>
        This file has been changed on disk.
      </div>
      <div class="toast-actions">
        <button class="btn-primary" (click)="reload.emit()">Reload</button>
        <button class="btn-secondary" (click)="ignore.emit()">Dismiss</button>
      </div>
    </div>
  `,
  styles: [`
    .toast {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
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
    .toast-message {
      font-size: 14px;
    }
    .toast-icon {
      margin-right: 6px;
      font-weight: bold;
    }
    .toast-actions {
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
export class ReloadToastComponent {
  @Output() reload = new EventEmitter<void>();
  @Output() ignore = new EventEmitter<void>();
}

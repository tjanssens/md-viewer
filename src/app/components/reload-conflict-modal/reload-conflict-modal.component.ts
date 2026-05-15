import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reload-conflict-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="keepMine.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>File changed on disk</h2>
        <p>
          You have unsaved changes. The file on disk has been changed by another process.
        </p>
        <p>What do you want to do?</p>
        <div class="modal-actions">
          <button class="btn-danger" (click)="loadFromDisk.emit()">
            Load file from disk (discard my changes)
          </button>
          <button class="btn-primary" (click)="keepMine.emit()">
            Keep my version
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: var(--color-modal-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
    }
    .modal {
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 24px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    }
    h2 {
      margin: 0 0 12px;
      color: var(--color-heading);
      font-size: 18px;
    }
    p {
      margin: 0 0 12px;
      font-size: 14px;
    }
    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      border: 1px solid var(--color-border);
      text-align: left;
    }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-primary:hover {
      background: var(--color-primary-hover);
    }
    .btn-danger {
      background: var(--color-bg);
      color: var(--color-text);
    }
    .btn-danger:hover {
      background: var(--color-bg-elevated);
    }
  `]
})
export class ReloadConflictModalComponent {
  @Output() loadFromDisk = new EventEmitter<void>();
  @Output() keepMine = new EventEmitter<void>();
}

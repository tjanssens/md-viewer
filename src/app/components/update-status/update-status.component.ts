import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdateStatus } from '../../electron.d';

@Component({
  selector: 'app-update-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="update-panel">
      <div class="update-row">
        <div class="update-message">
          <span class="update-icon" [class.spin]="status.state === 'checking' || status.state === 'downloading'">
            {{ icon }}
          </span>
          <span>{{ message }}</span>
        </div>
        <button class="close-btn" title="Close" (click)="dismiss.emit()">×</button>
      </div>

      <div class="progress" *ngIf="status.state === 'downloading' && status.percent !== undefined">
        <div class="progress-bar" [style.width.%]="status.percent"></div>
      </div>

      <div class="update-actions">
        <button
          *ngIf="status.state === 'downloaded'"
          class="btn-primary"
          (click)="action.emit()">
          Restart &amp; update
        </button>
        <button
          *ngIf="status.state === 'available'"
          class="btn-primary"
          (click)="action.emit()">
          Download
        </button>
        <button
          *ngIf="status.state === 'not-available' || status.state === 'error'"
          class="btn-secondary"
          (click)="checkAgain.emit()">
          Check again
        </button>
        <button class="btn-link" (click)="showLog = !showLog">
          {{ showLog ? 'Hide details' : 'Details' }}
        </button>
      </div>

      <pre class="update-log" *ngIf="showLog">{{ logs.length ? logs.join('\n') : 'No log output yet.' }}</pre>
    </div>
  `,
  styles: [`
    .update-panel {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 380px;
      max-width: calc(100vw - 32px);
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      background: var(--color-toast-bg);
      color: var(--color-toast-text);
      border: 1px solid var(--color-toast-border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 2000;
    }
    .update-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .update-message {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .update-icon {
      font-weight: bold;
      display: inline-block;
    }
    .update-icon.spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .close-btn {
      background: transparent;
      border: none;
      color: var(--color-toast-text);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    .progress {
      width: 100%;
      height: 6px;
      background: var(--color-toast-border);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.2s ease;
    }
    .update-actions {
      display: flex;
      align-items: center;
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
    .btn-link {
      background: transparent;
      border: none;
      color: var(--color-primary);
      margin-left: auto;
      padding: 6px 4px;
    }
    .update-log {
      margin: 0;
      max-height: 180px;
      overflow: auto;
      padding: 8px;
      background: var(--color-bg);
      border: 1px solid var(--color-toast-border);
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `]
})
export class UpdateStatusComponent {
  @Input() status: UpdateStatus = { state: 'checking' };
  @Input() logs: string[] = [];
  @Output() action = new EventEmitter<void>();
  @Output() checkAgain = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  showLog = false;

  get icon(): string {
    switch (this.status.state) {
      case 'checking': return '↻';
      case 'downloading': return '↻';
      case 'available': return '⬆';
      case 'downloaded': return '⬆';
      case 'not-available': return '✓';
      case 'error': return '⚠';
      default: return '•';
    }
  }

  get message(): string {
    const v = this.status.version ? ` ${this.status.version}` : '';
    switch (this.status.state) {
      case 'checking':
        return 'Checking for updates…';
      case 'downloading':
        return this.status.percent !== undefined
          ? `Downloading update${v}… ${this.status.percent}%`
          : `Downloading update${v}…`;
      case 'available':
        return `Version${v} is available.`;
      case 'downloaded':
        return `Version${v} has been downloaded and is ready to install.`;
      case 'not-available':
        return `You're up to date${v ? ` (v${this.status.version})` : ''}.`;
      case 'error':
        return `Update check failed: ${this.status.message || 'unknown error'}`;
      default:
        return '';
    }
  }
}

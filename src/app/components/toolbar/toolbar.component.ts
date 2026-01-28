import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';
import { SettingsService, AppSettings } from '../../services/settings.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn" (click)="onOpen()" title="Open file (Ctrl+O)">
          <span class="icon">📂</span>
          Open
        </button>
        <button class="btn" (click)="onSave()" [disabled]="!hasContent" title="Save file (Ctrl+S)">
          <span class="icon">💾</span>
          Save
        </button>
        <button class="btn" (click)="onSaveAs()" [disabled]="!hasContent" title="Save as (Ctrl+Shift+S)">
          <span class="icon">📄</span>
          Save As
        </button>
        <div class="separator"></div>
        <button
          class="btn"
          [class.active]="isEditMode"
          (click)="toggleEdit.emit()"
          title="Toggle edit mode (Ctrl+E)">
          <span class="icon">✏️</span>
          {{ isEditMode ? 'View' : 'Edit' }}
        </button>
      </div>

      <div class="toolbar-right">
        <div class="font-selector">
          <label>Font:</label>
          <select [(ngModel)]="selectedFont" (ngModelChange)="onFontChange($event)">
            <option *ngFor="let font of fonts" [value]="font">{{ font }}</option>
          </select>
        </div>
        <div class="font-size-selector">
          <label>Size:</label>
          <select [(ngModel)]="selectedSize" (ngModelChange)="onSizeChange($event)">
            <option *ngFor="let size of fontSizes" [value]="size">{{ size }}px</option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
      border-bottom: 1px solid #dee2e6;
      gap: 16px;
      flex-shrink: 0;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid #ced4da;
      border-radius: 6px;
      background: #ffffff;
      color: #495057;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn:hover:not(:disabled) {
      background: #e9ecef;
      border-color: #adb5bd;
    }

    .btn:active:not(:disabled) {
      background: #dee2e6;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.active {
      background: #0d6efd;
      color: white;
      border-color: #0d6efd;
    }

    .btn.active:hover {
      background: #0b5ed7;
    }

    .icon {
      font-size: 16px;
    }

    .separator {
      width: 1px;
      height: 28px;
      background: #dee2e6;
      margin: 0 8px;
    }

    .font-selector, .font-size-selector {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    label {
      font-size: 13px;
      color: #6c757d;
      font-weight: 500;
    }

    select {
      padding: 6px 12px;
      border: 1px solid #ced4da;
      border-radius: 6px;
      background: #ffffff;
      font-size: 13px;
      color: #495057;
      cursor: pointer;
      min-width: 140px;
    }

    select:hover {
      border-color: #adb5bd;
    }

    select:focus {
      outline: none;
      border-color: #0d6efd;
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
    }
  `]
})
export class ToolbarComponent implements OnInit {
  @Input() isEditMode = false;
  @Input() hasContent = false;
  @Output() toggleEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() saveAs = new EventEmitter<void>();
  @Output() open = new EventEmitter<void>();

  fonts: string[] = [];
  fontSizes = [12, 14, 16, 18, 20, 22, 24, 28, 32];
  selectedFont = 'Georgia';
  selectedSize = 16;

  constructor(
    private electronService: ElectronService,
    private settingsService: SettingsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.fonts = await this.electronService.getSystemFonts();

    const settings = this.settingsService.getSettings();
    this.selectedFont = settings.fontFamily;
    this.selectedSize = settings.fontSize;
  }

  onFontChange(font: string): void {
    this.settingsService.setFontFamily(font);
  }

  onSizeChange(size: number): void {
    this.settingsService.setFontSize(size);
  }

  onOpen(): void {
    this.open.emit();
  }

  onSave(): void {
    this.save.emit();
  }

  onSaveAs(): void {
    this.saveAs.emit();
  }
}

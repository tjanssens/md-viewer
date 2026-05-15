import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';
import { SettingsService, AppSettings, Theme } from '../../services/settings.service';

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
        <button class="btn" (click)="onPrint()" [disabled]="!hasContent" title="Print (Ctrl+P)">
          <span class="icon">🖨️</span>
          Print
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
        <div class="theme-selector">
          <button class="theme-btn" [title]="'Thema: ' + currentTheme">🌓</button>
          <div class="theme-menu">
            <button (click)="setTheme('auto')" [class.active]="currentTheme === 'auto'">Auto</button>
            <button (click)="setTheme('light')" [class.active]="currentTheme === 'light'">Licht</button>
            <button (click)="setTheme('dark')" [class.active]="currentTheme === 'dark'">Donker</button>
          </div>
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
      background: var(--color-bg-elevated);
      border-bottom: 1px solid var(--color-border);
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
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn:hover:not(:disabled) {
      background: var(--color-bg-elevated);
      border-color: var(--color-border-strong);
    }

    .btn:active:not(:disabled) {
      background: var(--color-border);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.active {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }

    .btn.active:hover {
      background: var(--color-primary-hover);
    }

    .icon {
      font-size: 16px;
    }

    .separator {
      width: 1px;
      height: 28px;
      background: var(--color-border);
      margin: 0 8px;
    }

    .font-selector, .font-size-selector {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    label {
      font-size: 13px;
      color: var(--color-text-muted);
      font-weight: 500;
    }

    select {
      padding: 6px 12px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 13px;
      cursor: pointer;
      min-width: 140px;
    }

    select:hover {
      border-color: var(--color-border-strong);
    }

    select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
    }

    .theme-selector {
      position: relative;
      display: inline-block;
    }

    .theme-selector:hover .theme-menu,
    .theme-selector:focus-within .theme-menu {
      display: flex;
    }

    .theme-btn {
      background: none;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 16px;
      color: var(--color-text);
    }

    .theme-btn:hover {
      background: var(--color-bg-elevated);
    }

    .theme-menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      flex-direction: column;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 100;
      min-width: 120px;
    }

    .theme-menu button {
      background: none;
      border: none;
      padding: 8px 12px;
      text-align: left;
      cursor: pointer;
      color: var(--color-text);
      font-size: 14px;
    }

    .theme-menu button:hover {
      background: var(--color-bg-elevated);
    }

    .theme-menu button.active {
      background: var(--color-primary);
      color: white;
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
  @Output() print = new EventEmitter<void>();

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

  onPrint(): void {
    this.print.emit();
  }

  get currentTheme(): Theme {
    return this.settingsService.getSettings().theme;
  }

  setTheme(theme: Theme): void {
    this.settingsService.setTheme(theme);
  }
}

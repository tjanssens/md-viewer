import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { MarkdownEditorComponent } from './components/markdown-editor/markdown-editor.component';
import { SplitPaneComponent } from './components/split-pane/split-pane.component';
import { ElectronService } from './services/electron.service';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    MarkdownViewerComponent,
    MarkdownEditorComponent,
    SplitPaneComponent
  ],
  template: `
    <div class="app-container">
      <app-toolbar
        [isEditMode]="isEditMode"
        [hasContent]="content.length > 0"
        (toggleEdit)="toggleEditMode()"
        (save)="saveFile()"
        (saveAs)="saveFileAs()"
        (open)="openFile()">
      </app-toolbar>

      <div class="main-content">
        <!-- View Mode -->
        <div *ngIf="!isEditMode" class="view-mode">
          <app-markdown-viewer
            [content]="content"
            class="full-viewer">
          </app-markdown-viewer>
        </div>

        <!-- Edit Mode with Split Pane -->
        <div *ngIf="isEditMode" class="edit-mode">
          <app-split-pane>
            <app-markdown-editor
              left
              [content]="content"
              (contentChange)="onContentChange($event)"
              (scrollChange)="onEditorScroll($event)">
            </app-markdown-editor>
            <app-markdown-viewer
              right
              [content]="content"
              [scrollPercent]="editorScrollPercent"
              class="preview-viewer">
            </app-markdown-viewer>
          </app-split-pane>
        </div>
      </div>

      <!-- Welcome screen when no content -->
      <div *ngIf="!content && !isEditMode" class="welcome-overlay">
        <div class="welcome-content">
          <h1>MD Viewer</h1>
          <p>Open a Markdown file to get started</p>
          <button class="welcome-btn" (click)="openFile()">
            <span class="icon">📂</span>
            Open File
          </button>
          <p class="hint">Or drag and drop a .md file here</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .main-content {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .view-mode, .edit-mode {
      height: 100%;
    }

    .full-viewer, .preview-viewer {
      height: 100%;
    }

    .preview-viewer {
      background: #ffffff;
      border-left: 1px solid #e9ecef;
    }

    .welcome-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
    }

    .welcome-content {
      text-align: center;
      padding: 48px;
    }

    .welcome-content h1 {
      font-size: 48px;
      font-weight: 300;
      color: #343a40;
      margin: 0 0 16px;
    }

    .welcome-content p {
      font-size: 18px;
      color: #6c757d;
      margin: 0 0 32px;
    }

    .welcome-btn {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 32px;
      font-size: 18px;
      font-weight: 500;
      color: #ffffff;
      background: #0d6efd;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .welcome-btn:hover {
      background: #0b5ed7;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
    }

    .welcome-btn .icon {
      font-size: 24px;
    }

    .hint {
      margin-top: 24px !important;
      font-size: 14px !important;
      color: #adb5bd !important;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  content = '';
  isEditMode = false;
  editorScrollPercent = 0;
  currentFilePath: string | null = null;
  hasUnsavedChanges = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private electronService: ElectronService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    // Subscribe to file opened events (from file association or menu)
    this.subscriptions.push(
      this.electronService.fileOpened$.subscribe(data => {
        this.content = data.content;
        this.currentFilePath = data.filePath;
        this.hasUnsavedChanges = false;
      })
    );

    // Subscribe to menu events
    this.subscriptions.push(
      this.electronService.menuSave$.subscribe(() => this.saveFile())
    );

    this.subscriptions.push(
      this.electronService.menuSaveAs$.subscribe(() => this.saveFileAs())
    );

    this.subscriptions.push(
      this.electronService.menuOpen$.subscribe(() => this.openFile())
    );

    this.subscriptions.push(
      this.electronService.menuToggleEdit$.subscribe(() => this.toggleEditMode())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async openFile(): Promise<void> {
    const result = await this.electronService.openFileDialog();
    if (result) {
      this.content = result.content;
      this.currentFilePath = result.filePath;
      this.hasUnsavedChanges = false;
    }
  }

  async saveFile(): Promise<void> {
    if (!this.content) return;

    const filePath = await this.electronService.getCurrentFilePath();
    if (filePath) {
      const success = await this.electronService.saveFile(this.content);
      if (success) {
        this.hasUnsavedChanges = false;
      }
    } else {
      // No current file, use Save As
      await this.saveFileAs();
    }
  }

  async saveFileAs(): Promise<void> {
    if (!this.content) return;

    const success = await this.electronService.saveFileAs(this.content);
    if (success) {
      this.hasUnsavedChanges = false;
      this.currentFilePath = await this.electronService.getCurrentFilePath();
    }
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
  }

  onContentChange(newContent: string): void {
    this.content = newContent;
    this.hasUnsavedChanges = true;
  }

  onEditorScroll(percent: number): void {
    this.editorScrollPercent = percent;
  }
}

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { MarkdownEditorComponent } from './components/markdown-editor/markdown-editor.component';
import { SplitPaneComponent } from './components/split-pane/split-pane.component';
import { ElectronService } from './services/electron.service';
import { SettingsService } from './services/settings.service';
import { ThemeService } from './services/theme.service';
import { FeedbackPopoverComponent } from './components/feedback-popover/feedback-popover.component';
import { FeedbackSidebarComponent } from './components/feedback-sidebar/feedback-sidebar.component';
import { FeedbackService } from './services/feedback.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    MarkdownViewerComponent,
    MarkdownEditorComponent,
    SplitPaneComponent,
    FeedbackPopoverComponent,
    FeedbackSidebarComponent
  ],
  template: `
    <div class="app-container">
      <app-toolbar
        [isEditMode]="isEditMode"
        [hasContent]="content.length > 0"
        [feedbackSidebarOpen]="feedbackSidebarOpen"
        (toggleEdit)="toggleEditMode()"
        (save)="saveFile()"
        (saveAs)="saveFileAs()"
        (open)="openFile()"
        (print)="printFile()"
        (toggleFeedbackSidebar)="toggleFeedbackSidebar()">
      </app-toolbar>

      <div class="main-content">
        <!-- View Mode -->
        <div *ngIf="!isEditMode" class="view-mode">
          <app-markdown-viewer
            [content]="content"
            (requestFeedback)="onRequestFeedback($event)"
            class="full-viewer">
          </app-markdown-viewer>
          <app-feedback-sidebar
            *ngIf="feedbackSidebarOpen"
            (close)="toggleFeedbackSidebar()"
            (scrollTo)="onFeedbackScrollTo($event)">
          </app-feedback-sidebar>
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

      <app-feedback-popover
        *ngIf="feedbackPopoverVisible"
        [top]="feedbackPopoverTop"
        [left]="feedbackPopoverLeft"
        [snippet]="feedbackPopoverSnippet"
        (save)="onFeedbackSave($event)"
        (cancel)="onFeedbackCancel()">
      </app-feedback-popover>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--color-bg);
      color: var(--color-text);
    }

    .main-content {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .view-mode {
      height: 100%;
      display: flex;
    }
    .edit-mode {
      height: 100%;
    }
    .full-viewer {
      flex: 1;
    }
    .full-viewer, .preview-viewer {
      height: 100%;
    }

    .preview-viewer {
      background: var(--color-bg);
      border-left: 1px solid var(--color-border);
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
      background: var(--color-bg-welcome);
    }

    .welcome-content {
      text-align: center;
      padding: 48px;
    }

    .welcome-content h1 {
      font-size: 48px;
      font-weight: 300;
      color: var(--color-heading);
      margin: 0 0 16px;
    }

    .welcome-content p {
      font-size: 18px;
      color: var(--color-text-muted);
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
      background: var(--color-primary);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .welcome-btn:hover {
      background: var(--color-primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
    }

    .welcome-btn .icon {
      font-size: 24px;
    }

    .hint {
      margin-top: 24px !important;
      font-size: 14px !important;
      color: var(--color-text-subtle) !important;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  content = '';
  isEditMode = false;
  editorScrollPercent = 0;
  currentFilePath: string | null = null;
  hasUnsavedChanges = false;

  feedbackPopoverVisible = false;
  feedbackPopoverTop = 0;
  feedbackPopoverLeft = 0;
  feedbackPopoverSnippet = '';
  feedbackSidebarOpen = false;
  @ViewChild(MarkdownViewerComponent) viewerComponent?: MarkdownViewerComponent;
  private pendingFeedback: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
  } | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private electronService: ElectronService,
    private settingsService: SettingsService,
    private themeService: ThemeService,
    private feedbackService: FeedbackService
  ) {}

  ngOnInit(): void {
    // Subscribe to file opened events (from file association or menu)
    this.subscriptions.push(
      this.electronService.fileOpened$.subscribe(data => {
        this.content = data.content;
        this.currentFilePath = data.filePath;
        this.feedbackService.setCurrentFile(this.currentFilePath);
        (window as any).__currentFilename = this.currentFilePath?.split(/[/\\]/).pop() || 'document.md';
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

    this.subscriptions.push(
      this.electronService.menuPrint$.subscribe(() => this.printFile())
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
      this.feedbackService.setCurrentFile(this.currentFilePath);
      (window as any).__currentFilename = this.currentFilePath?.split(/[/\\]/).pop() || 'document.md';
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
      this.feedbackService.setCurrentFile(this.currentFilePath);
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

  printFile(): void {
    if (!this.content) return;
    window.print();
  }

  onRequestFeedback(data: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
    rect: { top: number; left: number; bottom: number };
  }): void {
    this.pendingFeedback = {
      selectedText: data.selectedText,
      contextBefore: data.contextBefore,
      contextAfter: data.contextAfter,
      headingPath: data.headingPath
    };
    this.feedbackPopoverSnippet = data.selectedText.slice(0, 80);
    this.feedbackPopoverTop = data.rect.bottom + 8;
    this.feedbackPopoverLeft = Math.max(8, data.rect.left);
    this.feedbackPopoverVisible = true;
  }

  onFeedbackSave(feedback: string): void {
    if (!this.pendingFeedback) return;
    this.feedbackService.add({
      selectedText: this.pendingFeedback.selectedText,
      contextBefore: this.pendingFeedback.contextBefore,
      contextAfter: this.pendingFeedback.contextAfter,
      headingPath: this.pendingFeedback.headingPath,
      feedback
    });
    this.feedbackPopoverVisible = false;
    this.pendingFeedback = null;
  }

  onFeedbackCancel(): void {
    this.feedbackPopoverVisible = false;
    this.pendingFeedback = null;
  }

  toggleFeedbackSidebar(): void {
    this.feedbackSidebarOpen = !this.feedbackSidebarOpen;
  }

  onFeedbackScrollTo(id: string): void {
    this.viewerComponent?.scrollToFeedback(id);
  }
}

import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-split-pane',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="split-container" #container>
      <div class="split-left" [style.width.%]="leftWidth">
        <ng-content select="[left]"></ng-content>
      </div>
      <div
        class="split-divider"
        (mousedown)="startDrag($event)"
        [class.dragging]="isDragging">
        <div class="divider-handle"></div>
      </div>
      <div class="split-right" [style.width.%]="100 - leftWidth">
        <ng-content select="[right]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .split-container {
      display: flex;
      height: 100%;
      overflow: hidden;
    }

    .split-left, .split-right {
      height: 100%;
      overflow: hidden;
    }

    .split-left {
      min-width: 200px;
    }

    .split-right {
      min-width: 200px;
    }

    .split-divider {
      width: 6px;
      background: #e9ecef;
      cursor: col-resize;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s ease;
    }

    .split-divider:hover,
    .split-divider.dragging {
      background: #dee2e6;
    }

    .divider-handle {
      width: 2px;
      height: 40px;
      background: #adb5bd;
      border-radius: 1px;
    }

    .split-divider:hover .divider-handle,
    .split-divider.dragging .divider-handle {
      background: #6c757d;
    }
  `]
})
export class SplitPaneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  leftWidth = 50;
  isDragging = false;

  private mouseMoveHandler = this.onMouseMove.bind(this);
  private mouseUpHandler = this.onMouseUp.bind(this);

  ngAfterViewInit(): void {
    // Initial setup if needed
  }

  ngOnDestroy(): void {
    this.removeDragListeners();
  }

  startDrag(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.containerRef?.nativeElement) return;

    const container = this.containerRef.nativeElement;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = event.clientX - containerRect.left;

    // Calculate percentage (accounting for divider width)
    let newLeftWidth = (mouseX / containerWidth) * 100;

    // Clamp between 20% and 80%
    newLeftWidth = Math.max(20, Math.min(80, newLeftWidth));

    this.leftWidth = newLeftWidth;
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.removeDragListeners();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  private removeDragListeners(): void {
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
  }
}

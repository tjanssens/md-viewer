import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FeedbackStatus = 'open' | 'processed' | 'orphaned';

export interface FeedbackItem {
  id: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  headingPath: string[];
  feedback: string;
  status: FeedbackStatus;
  createdAt: string;
  shifted?: boolean;
}

const STORAGE_PREFIX = 'feedback:';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private currentFilePath: string | null = null;
  private itemsSubject = new BehaviorSubject<FeedbackItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  setCurrentFile(filePath: string | null): void {
    this.currentFilePath = filePath;
    this.itemsSubject.next(this.loadItems());
  }

  add(item: Omit<FeedbackItem, 'id' | 'createdAt' | 'status'>): FeedbackItem {
    const newItem: FeedbackItem = {
      ...item,
      id: this.generateId(),
      status: 'open',
      createdAt: new Date().toISOString()
    };
    const updated = [...this.itemsSubject.value, newItem];
    this.persist(updated);
    return newItem;
  }

  update(id: string, changes: Partial<FeedbackItem>): void {
    const updated = this.itemsSubject.value.map(item =>
      item.id === id ? { ...item, ...changes } : item
    );
    this.persist(updated);
  }

  remove(id: string): void {
    const updated = this.itemsSubject.value.filter(item => item.id !== id);
    this.persist(updated);
  }

  removeByStatus(status: FeedbackStatus): void {
    const updated = this.itemsSubject.value.filter(item => item.status !== status);
    this.persist(updated);
  }

  replaceAll(items: FeedbackItem[]): void {
    this.persist(items);
  }

  getItems(): FeedbackItem[] {
    return this.itemsSubject.value;
  }

  private generateId(): string {
    return 'fb_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }

  private loadItems(): FeedbackItem[] {
    if (!this.currentFilePath) return [];
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + this.currentFilePath);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading feedback:', error);
      return [];
    }
  }

  private persist(items: FeedbackItem[]): void {
    this.itemsSubject.next(items);
    if (!this.currentFilePath) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + this.currentFilePath, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  }
}

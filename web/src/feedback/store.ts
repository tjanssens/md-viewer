import { api } from '../ipc';
import { FeedbackItem, FeedbackStatus, newId, normalizeFeedbackItems } from './model';

type Listener = (items: FeedbackItem[]) => void;

/** Feedback items for the current document, persisted through the Rust side. */
export class FeedbackStore {
  private items: FeedbackItem[] = [];
  private path: string | null = null;
  private listeners: Listener[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async setFile(path: string | null): Promise<void> {
    this.flush();
    this.path = path;
    this.items = [];
    if (path) {
      try {
        this.items = normalizeFeedbackItems(await api.feedbackLoad(path));
      } catch (e) {
        console.error('Error loading feedback:', e);
      }
    }
    this.emit();
  }

  /** The document was saved under a new name: carry the feedback along. */
  rename(path: string): void {
    this.path = path;
    this.persist(this.items);
  }

  get all(): FeedbackItem[] {
    return this.items;
  }

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  add(item: Omit<FeedbackItem, 'id' | 'createdAt' | 'status'>): FeedbackItem {
    const created: FeedbackItem = { ...item, id: newId(), status: 'open', createdAt: new Date().toISOString() };
    this.persist([...this.items, created]);
    return created;
  }

  update(id: string, changes: Partial<FeedbackItem>): void {
    this.persist(this.items.map(i => (i.id === id ? { ...i, ...changes } : i)));
  }

  remove(id: string): void {
    this.persist(this.items.filter(i => i.id !== id));
  }

  removeByStatus(status: FeedbackStatus): void {
    this.persist(this.items.filter(i => i.status !== status));
  }

  replaceAll(items: FeedbackItem[]): void {
    this.persist(items);
  }

  private persist(items: FeedbackItem[]): void {
    this.items = normalizeFeedbackItems(items);
    this.emit();
    if (!this.path) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 150);
  }

  private flush(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.path) api.feedbackSave(this.path, this.items).catch(e => console.error('Error saving feedback:', e));
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.items);
  }
}

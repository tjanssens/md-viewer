import { h, copyText } from '../dom';
import { FeedbackItem, feedbackToMarkdown } from './model';
import { FeedbackStore } from './store';

/** The feedback side panel. Re-renders from the store on every change. */
export class FeedbackSidebar {
  selectedId: string | null = null;
  private editing: { id: string; text: string } | null = null;
  filename = '';

  constructor(
    private root: HTMLElement,
    private store: FeedbackStore,
    private onClose: () => void,
    private onScrollTo: (id: string) => void
  ) {
    store.subscribe(() => this.render());
  }

  select(id: string): void {
    this.selectedId = id;
    this.render();
    this.root.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  render(): void {
    if (this.root.hidden) return;
    const items = this.store.all;
    const has = (s: string) => items.some(i => i.status === s);
    const list = h('div', { class: 'items' });
    for (const item of items) list.append(this.renderItem(item));
    if (items.length === 0) {
      list.append(h('div', { class: 'empty', text: 'No feedback yet. Select text in the viewer and click "💬 Add feedback".' }));
    }
    this.root.replaceChildren(
      h('header', { class: 'panel-header' },
        h('h3', { text: `Feedback (${items.length})` }),
        h('button', { class: 'close-btn', title: 'Close', text: '✕', onclick: () => this.onClose() })
      ),
      h('div', { class: 'actions' },
        h('button', {
          class: 'copy-btn', disabled: !has('open'), text: '📋 Copy all feedback',
          onclick: () => copyText(feedbackToMarkdown(this.filename, this.store.all))
        }),
        h('div', { class: 'bulk-actions' },
          h('button', { disabled: !has('processed'), text: 'Remove processed', onclick: () => this.store.removeByStatus('processed') }),
          h('button', { disabled: !has('orphaned'), text: 'Remove orphaned', onclick: () => this.store.removeByStatus('orphaned') })
        )
      ),
      list
    );
    if (this.editing) {
      const ta = this.root.querySelector<HTMLTextAreaElement>('.edit-block textarea');
      ta?.focus();
    }
  }

  private renderItem(item: FeedbackItem): HTMLElement {
    const editing = this.editing?.id === item.id;
    const stop = (fn: () => void) => (e: Event) => {
      e.stopPropagation();
      fn();
    };
    const snippet = item.selectedText.length > 60 ? item.selectedText.slice(0, 60) + '…' : item.selectedText;
    const cls = ['item', item.status === 'processed' && 'processed', item.status === 'orphaned' && 'orphaned', item.id === this.selectedId && 'selected']
      .filter(Boolean)
      .join(' ');

    let body: HTMLElement;
    if (editing) {
      const ta = h('textarea', { rows: 4, placeholder: 'Feedback… (Enter to save, Shift+Enter for new line)' }) as HTMLTextAreaElement;
      ta.value = this.editing!.text;
      const save = h('button', { class: 'btn-save', disabled: !ta.value.trim(), onclick: () => this.saveEdit(item, ta.value) }, 'Save ', h('span', { class: 'kbd', text: 'Enter' }));
      ta.addEventListener('input', () => {
        this.editing = { id: item.id, text: ta.value };
        (save as HTMLButtonElement).disabled = !ta.value.trim();
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEdit();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.saveEdit(item, ta.value);
        }
      });
      body = h('div', { class: 'edit-block', onclick: (e: Event) => e.stopPropagation() },
        ta,
        h('div', { class: 'edit-actions' }, h('button', { class: 'btn-cancel', text: 'Cancel', onclick: () => this.cancelEdit() }), save)
      );
    } else {
      body = h('div', { class: 'item-feedback', text: item.feedback });
    }

    return h('div', { class: cls, 'data-item-id': item.id, onclick: () => item.status !== 'orphaned' && this.onScrollTo(item.id) },
      h('div', { class: 'item-header' },
        item.headingPath.length > 0 ? h('span', { class: 'item-path', text: item.headingPath.join(' › ') }) : null,
        editing ? null : h('span', { class: 'item-actions' },
          h('button', { title: 'Edit', text: '✏️', onclick: stop(() => this.startEdit(item)) }),
          item.status !== 'processed'
            ? h('button', { title: 'Mark as processed', text: '✓', onclick: stop(() => this.store.update(item.id, { status: 'processed' })) })
            : h('button', { title: 'Mark as open', text: '↺', onclick: stop(() => this.store.update(item.id, { status: 'open' })) }),
          h('button', { title: 'Delete', text: '🗑️', onclick: stop(() => this.store.remove(item.id)) })
        )
      ),
      h('div', { class: 'item-snippet', text: `"${snippet}"` }),
      body,
      h('div', { class: 'item-badges' },
        item.shifted && item.status !== 'orphaned' ? h('span', { class: 'badge', text: '📍 shifted' }) : null,
        item.status === 'orphaned' ? h('span', { class: 'badge', text: '⚠️ not found' }) : null,
        item.status === 'processed' ? h('span', { class: 'badge', text: '✓ processed' }) : null
      )
    );
  }

  private startEdit(item: FeedbackItem): void {
    this.editing = { id: item.id, text: item.feedback };
    this.render();
  }

  private saveEdit(item: FeedbackItem, text: string): void {
    this.editing = null;
    const t = text.trim();
    if (t) this.store.update(item.id, { feedback: t });
    else this.render();
  }

  private cancelEdit(): void {
    this.editing = null;
    this.render();
  }
}

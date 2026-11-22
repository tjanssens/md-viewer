import { h } from './dom';
import type { FeedbackItem } from './feedback/model';
import type { Heading } from './viewer';

export function renderOutline(list: HTMLElement, headings: Heading[], items: FeedbackItem[], onSelect: (i: number) => void): void {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.status === 'orphaned') continue;
    for (const heading of item.headingPath) counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }
  const frag = document.createDocumentFragment();
  headings.forEach((hd, i) => {
    const n = counts.get(hd.text) ?? 0;
    frag.append(
      h(
        'button',
        {
          class: `outline-item level-${hd.level}`,
          style: `padding-left:${(hd.level - 1) * 12 + 12}px`,
          title: hd.text,
          onclick: () => onSelect(i)
        },
        h('span', { class: 'outline-text', text: hd.text }),
        n > 0 ? h('span', { class: 'feedback-badge', title: 'Feedback present', text: `💬 ${n}` }) : null
      )
    );
  });
  if (headings.length === 0) frag.append(h('div', { class: 'empty', text: 'No headings in this document.' }));
  list.replaceChildren(frag);
}

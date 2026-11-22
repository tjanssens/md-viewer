/** A rendered top-level block as sent by the Rust side. */
export interface Block {
  id: string;
  line: number;
  html?: string;
  h?: number;
  t?: string;
}

export interface PatchResult {
  /** Elements that were newly created (need code highlighting etc.). */
  created: HTMLElement[];
  /** False when the DOM could not be patched (missing HTML for an unknown block). */
  ok: boolean;
}

/**
 * Bring the children of `root` in line with `blocks`, touching only what
 * changed. Unchanged leading and trailing blocks are left alone; blocks in
 * the middle are reused by id when possible and created otherwise.
 */
export function patchBlocks(root: HTMLElement, blocks: Block[], reset: boolean): PatchResult {
  const created: HTMLElement[] = [];
  if (reset) {
    const parts: string[] = [];
    for (const b of blocks) {
      if (b.html === undefined) return { created, ok: false };
      parts.push(`<div class="mb" data-id="${b.id}">${b.html}</div>`);
    }
    root.innerHTML = parts.join('');
    for (const el of Array.from(root.children)) created.push(el as HTMLElement);
    return { created, ok: true };
  }

  const old = Array.from(root.children) as HTMLElement[];
  const oldIds = old.map(el => el.dataset['id'] ?? '');

  let prefix = 0;
  while (prefix < old.length && prefix < blocks.length && oldIds[prefix] === blocks[prefix].id) prefix++;
  let suffix = 0;
  while (
    suffix < old.length - prefix &&
    suffix < blocks.length - prefix &&
    oldIds[old.length - 1 - suffix] === blocks[blocks.length - 1 - suffix].id
  ) suffix++;

  const middleOld = old.slice(prefix, old.length - suffix);
  const byId = new Map<string, HTMLElement>();
  for (const el of middleOld) byId.set(el.dataset['id'] ?? '', el);

  const anchor = suffix > 0 ? old[old.length - suffix] : null;
  const keep = new Set<HTMLElement>();
  const newMiddle = blocks.slice(prefix, blocks.length - suffix);

  // Validate first so a failed patch leaves the DOM untouched.
  for (const b of newMiddle) {
    if (!byId.has(b.id) && b.html === undefined) return { created, ok: false };
  }

  const tpl = document.createElement('template');
  const nodes: HTMLElement[] = [];
  for (const b of newMiddle) {
    const existing = byId.get(b.id);
    if (existing && !keep.has(existing)) {
      keep.add(existing);
      nodes.push(existing);
    } else {
      tpl.innerHTML = `<div class="mb" data-id="${b.id}">${b.html ?? ''}</div>`;
      const el = tpl.content.firstElementChild as HTMLElement;
      created.push(el);
      nodes.push(el);
    }
  }
  for (const el of middleOld) if (!keep.has(el)) el.remove();
  // Insert in order (moves reused nodes into place).
  for (const el of nodes) {
    if (el.nextElementSibling !== anchor || el.parentNode !== root) root.insertBefore(el, anchor);
  }
  return { created, ok: true };
}

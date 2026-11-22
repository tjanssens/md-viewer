/** Map between DOM text nodes and offsets in the concatenated text of a root. */
export class TextIndex {
  readonly nodes: Text[] = [];
  readonly starts: number[] = [];
  readonly text: string;

  constructor(root: Node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let total = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      this.nodes.push(t);
      this.starts.push(total);
      parts.push(t.data);
      total += t.data.length;
    }
    this.text = parts.join('');
  }

  /** Index of the last node whose start <= offset. */
  nodeAt(offset: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid] <= offset) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  private startOf(node: Node): number | undefined {
    // Text nodes are in document order, so a binary search by position works.
    let lo = 0;
    let hi = this.nodes.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const other = this.nodes[mid];
      if (other === node) return this.starts[mid];
      const pos = other.compareDocumentPosition(node);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  /** Text offset of a DOM range boundary (node, offset). */
  offsetOf(node: Node, offset: number): number {
    if (node.nodeType === Node.TEXT_NODE) return (this.startOf(node) ?? 0) + offset;
    // Element boundary: offset indexes childNodes (triple-click, select all).
    const children = node.childNodes;
    if (offset >= children.length) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let last: Text | null = null;
      let n: Node | null;
      while ((n = walker.nextNode())) last = n as Text;
      if (last) return (this.startOf(last) ?? 0) + last.data.length;
      // Empty element: find the first text node after it.
      return this.firstAfter(node);
    }
    const child = children[offset];
    if (child.nodeType === Node.TEXT_NODE) return this.startOf(child) ?? 0;
    const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    return first ? this.startOf(first) ?? 0 : this.firstAfter(child);
  }

  private firstAfter(node: Node): number {
    for (let i = 0; i < this.nodes.length; i++) {
      if (node.compareDocumentPosition(this.nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING) return this.starts[i];
    }
    return this.text.length;
  }
}

const NO_WRAP_PARENTS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'UL', 'OL', 'DL', 'COLGROUP']);

/**
 * Wrap [start, end) in highlight spans. Ranges must be applied in descending
 * order of start so the index stays valid for the ones still to come.
 */
export function wrapRange(index: TextIndex, start: number, end: number, make: () => HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let i = index.nodeAt(start);
  if (i < 0) i = 0;
  for (; i < index.nodes.length; i++) {
    const nodeStart = index.starts[i];
    if (nodeStart >= end) break;
    let node = index.nodes[i];
    const len = node.data.length;
    const s = Math.max(start, nodeStart) - nodeStart;
    const e = Math.min(end, nodeStart + len) - nodeStart;
    if (e <= s) continue;
    const parent = node.parentNode as Element | null;
    if (!parent || NO_WRAP_PARENTS.has(parent.nodeName)) continue;
    if (!node.data.slice(s, e).trim()) continue;
    if (s > 0) node = node.splitText(s);
    if (e - s < node.data.length) node.splitText(e - s);
    const span = make();
    parent.insertBefore(span, node);
    span.appendChild(node);
    out.push(span);
  }
  return out;
}

/** Remove highlight spans, merging the text back together. */
export function unwrapAll(root: Element, selector: string): void {
  const parents = new Set<Node>();
  for (const el of Array.from(root.querySelectorAll(selector))) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parents.add(parent);
  }
  for (const p of parents) p.normalize();
}

/** Heading texts that lead up to `node`, outermost first. */
export function headingPathFor(node: Node, headings: HTMLElement[]): string[] {
  const target = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!target) return [];
  const stack: { level: number; text: string }[] = [];
  for (const h of headings) {
    if (h === target || h.contains(target)) continue;
    if (!(h.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    const level = parseInt(h.tagName.charAt(1), 10);
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, text: h.textContent?.trim() || '' });
  }
  return stack.map(h => h.text);
}

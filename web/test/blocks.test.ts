import { patchBlocks, Block } from '../src/blocks';

function ids(root: HTMLElement): string[] {
  return Array.from(root.children).map(el => (el as HTMLElement).dataset['id']!);
}

describe('patchBlocks', () => {
  it('builds the DOM on reset', () => {
    const root = document.createElement('div');
    const res = patchBlocks(root, [{ id: 'a', line: 1, html: '<p>A</p>' }, { id: 'b', line: 3, html: '<p>B</p>' }], true);
    expect(res.ok).toBe(true);
    expect(ids(root)).toEqual(['a', 'b']);
    expect(root.textContent).toBe('AB');
  });

  it('only creates changed blocks and keeps the rest in place', () => {
    const root = document.createElement('div');
    patchBlocks(root, [
      { id: 'a', line: 1, html: '<p>A</p>' },
      { id: 'b', line: 3, html: '<p>B</p>' },
      { id: 'c', line: 5, html: '<p>C</p>' }
    ], true);
    const [a, , c] = Array.from(root.children);
    const next: Block[] = [{ id: 'a', line: 1 }, { id: 'x', line: 3, html: '<p>X</p>' }, { id: 'c', line: 5 }];
    const res = patchBlocks(root, next, false);
    expect(res.ok).toBe(true);
    expect(res.created.length).toBe(1);
    expect(ids(root)).toEqual(['a', 'x', 'c']);
    expect(root.children[0]).toBe(a);
    expect(root.children[2]).toBe(c);
  });

  it('handles inserts, deletes and moves', () => {
    const root = document.createElement('div');
    patchBlocks(root, ['a', 'b', 'c', 'd'].map((id, i) => ({ id, line: i, html: `<p>${id}</p>` })), true);
    const b = root.children[1];
    patchBlocks(root, [{ id: 'a', line: 0 }, { id: 'c', line: 1 }, { id: 'n', line: 2, html: '<p>n</p>' }, { id: 'b', line: 3 }, { id: 'd', line: 4 }], false);
    expect(ids(root)).toEqual(['a', 'c', 'n', 'b', 'd']);
    expect(root.children[3]).toBe(b);
    patchBlocks(root, [{ id: 'd', line: 0 }], false);
    expect(ids(root)).toEqual(['d']);
  });

  it('reports out-of-sync blocks without touching the DOM', () => {
    const root = document.createElement('div');
    patchBlocks(root, [{ id: 'a', line: 1, html: '<p>A</p>' }], true);
    const res = patchBlocks(root, [{ id: 'zzz', line: 1 }], false);
    expect(res.ok).toBe(false);
    expect(ids(root)).toEqual(['a']);
  });
});

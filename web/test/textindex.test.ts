import { TextIndex, wrapRange, unwrapAll } from '../src/textindex';

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}
const mark = () => {
  const s = document.createElement('span');
  s.className = 'hl';
  return s;
};

describe('TextIndex', () => {
  it('maps offsets across elements', () => {
    const root = dom('<p>Hello <b>big</b> world</p>');
    const idx = new TextIndex(root);
    expect(idx.text).toBe('Hello big world');
    const b = root.querySelector('b')!.firstChild!;
    expect(idx.offsetOf(b, 1)).toBe(7);
    expect(idx.offsetOf(root.querySelector('p')!, 1)).toBe(6);
  });

  it('wraps a range that spans several text nodes and unwraps again', () => {
    const root = dom('<p>Hello <b>big</b> world</p>');
    const idx = new TextIndex(root);
    const spans = wrapRange(idx, 4, 12, mark);
    expect(spans.length).toBe(3);
    expect(Array.from(root.querySelectorAll('.hl')).map(s => s.textContent).join('')).toBe('o big wo');
    expect(root.textContent).toBe('Hello big world');
    unwrapAll(root, '.hl');
    expect(root.querySelectorAll('.hl').length).toBe(0);
    expect(root.querySelector('p')!.childNodes.length).toBe(3);
  });

  it('applies several ranges in descending order', () => {
    const root = dom('<p>one two three four</p>');
    const idx = new TextIndex(root);
    wrapRange(idx, 14, 18, mark);
    wrapRange(idx, 4, 7, mark);
    wrapRange(idx, 0, 3, mark);
    expect(Array.from(root.querySelectorAll('.hl')).map(s => s.textContent)).toEqual(['one', 'two', 'four']);
  });

  it('does not wrap whitespace between table rows', () => {
    const root = dom('<table><tbody>\n<tr><td>a</td></tr>\n<tr><td>b</td></tr>\n</tbody></table>');
    const idx = new TextIndex(root);
    wrapRange(idx, 0, idx.text.length, mark);
    expect(root.querySelector('tbody > span')).toBeNull();
    expect(root.querySelectorAll('td > .hl').length).toBe(2);
  });
});

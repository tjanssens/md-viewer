import { getHeadingPath } from './heading-path.util';

function buildDom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('getHeadingPath', () => {
  it('returns lege array als geen headings boven node staan', () => {
    const root = buildDom('<p id="t">hello</p>');
    const target = root.querySelector('#t')!;
    expect(getHeadingPath(target, root)).toEqual([]);
  });

  it('returns heading-pad bij geneste hiërarchie', () => {
    const root = buildDom(`
      <h1>Intro</h1><p>x</p>
      <h2>Setup</h2><p>y</p>
      <h3>Tools</h3><p id="t">target</p>
    `);
    const target = root.querySelector('#t')!;
    expect(getHeadingPath(target, root)).toEqual(['Intro', 'Setup', 'Tools']);
  });

  it('pop voorgaande heading wanneer een gelijk/lager level volgt', () => {
    const root = buildDom(`
      <h1>Intro</h1>
      <h2>Eerste</h2><p>x</p>
      <h2>Tweede</h2><p id="t">target</p>
    `);
    const target = root.querySelector('#t')!;
    expect(getHeadingPath(target, root)).toEqual(['Intro', 'Tweede']);
  });

  it('werkt met text node input', () => {
    const root = buildDom(`<h1>Intro</h1><p id="p">target</p>`);
    const textNode = root.querySelector('#p')!.firstChild!;
    expect(getHeadingPath(textNode, root)).toEqual(['Intro']);
  });

  it('negeert headings die na de target volgen', () => {
    const root = buildDom(`
      <h1>Eerste</h1>
      <p id="t">target</p>
      <h1>Tweede</h1>
    `);
    const target = root.querySelector('#t')!;
    expect(getHeadingPath(target, root)).toEqual(['Eerste']);
  });
});

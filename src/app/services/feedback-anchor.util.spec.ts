import { findAnchor, resolveStatus } from './feedback-anchor.util';
import { FeedbackItem } from './feedback.service';

function makeItem(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'x',
    selectedText: 'belangrijke tekst',
    contextBefore: 'voor de ',
    contextAfter: ' staat dit',
    headingPath: [],
    feedback: 'fb',
    status: 'open',
    createdAt: '2026-05-15T00:00:00Z',
    ...overrides
  };
}

describe('findAnchor', () => {
  it('vindt exact bij volledige context match', () => {
    const item = makeItem();
    const result = findAnchor(item, 'iets voor de belangrijke tekst staat dit en meer');
    expect(result.matchType).toBe('exact');
    expect(result.startIndex).toBe(13);
    expect(result.endIndex).toBe(30);
  });

  it('vindt fuzzy bij gewijzigde context', () => {
    const item = makeItem();
    const result = findAnchor(item, 'andere context belangrijke tekst andere afsluiter');
    expect(result.matchType).toBe('fuzzy');
    expect(result.startIndex).toBe(15);
    expect(result.endIndex).toBe(32);
  });

  it('returns none als selectedText niet aanwezig is', () => {
    const item = makeItem();
    const result = findAnchor(item, 'niets relevants hier');
    expect(result.matchType).toBe('none');
    expect(result.startIndex).toBe(-1);
    expect(result.endIndex).toBe(-1);
  });

  it('prefereert exact match boven fuzzy als beide kunnen', () => {
    const item = makeItem({ selectedText: 'X', contextBefore: 'aa', contextAfter: 'bb' });
    const result = findAnchor(item, 'X eerder, daarna aaXbb');
    expect(result.matchType).toBe('exact');
    expect(result.startIndex).toBe(19);
  });
});

describe('resolveStatus', () => {
  it('exact match houdt status open', () => {
    const item = makeItem({ status: 'open' });
    const status = resolveStatus(item, { matchType: 'exact', startIndex: 0, endIndex: 5 });
    expect(status.status).toBe('open');
    expect(status.shifted).toBe(false);
  });

  it('fuzzy match zet shifted true, status open', () => {
    const item = makeItem({ status: 'open' });
    const status = resolveStatus(item, { matchType: 'fuzzy', startIndex: 0, endIndex: 5 });
    expect(status.status).toBe('open');
    expect(status.shifted).toBe(true);
  });

  it('geen match zet status orphaned', () => {
    const item = makeItem({ status: 'open' });
    const status = resolveStatus(item, { matchType: 'none', startIndex: -1, endIndex: -1 });
    expect(status.status).toBe('orphaned');
    expect(status.shifted).toBe(false);
  });

  it('processed status blijft processed bij exact match', () => {
    const item = makeItem({ status: 'processed' });
    const status = resolveStatus(item, { matchType: 'exact', startIndex: 0, endIndex: 5 });
    expect(status.status).toBe('processed');
  });

  it('orphaned item komt terug naar open bij exact match', () => {
    const item = makeItem({ status: 'orphaned' });
    const status = resolveStatus(item, { matchType: 'exact', startIndex: 0, endIndex: 5 });
    expect(status.status).toBe('open');
  });

  it('orphaned item komt terug naar open bij fuzzy match', () => {
    const item = makeItem({ status: 'orphaned' });
    const status = resolveStatus(item, { matchType: 'fuzzy', startIndex: 0, endIndex: 5 });
    expect(status.status).toBe('open');
    expect(status.shifted).toBe(true);
  });
});

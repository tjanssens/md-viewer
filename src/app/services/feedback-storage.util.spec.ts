import { normalizeFeedbackItems } from './feedback-storage.util';

describe('normalizeFeedbackItems', () => {
  it('returns an empty list for non-array input', () => {
    expect(normalizeFeedbackItems(null)).toEqual([]);
    expect(normalizeFeedbackItems({ id: 'fb_1' })).toEqual([]);
  });

  it('drops malformed items that cannot be rendered safely', () => {
    const result = normalizeFeedbackItems([
      { id: 'fb_1', selectedText: '', feedback: 'missing text' },
      { id: 2, selectedText: 'text', feedback: 'bad id' },
      { id: 'fb_3', selectedText: 'text', feedback: 'bad status', status: 'closed' }
    ]);

    expect(result).toEqual([]);
  });

  it('normalizes valid legacy items with defaults', () => {
    const result = normalizeFeedbackItems([
      {
        id: 'fb_1',
        selectedText: 'Selected',
        contextBefore: 'Before ',
        contextAfter: ' after',
        headingPath: ['Intro'],
        feedback: 'Review this',
        createdAt: '2026-05-31T10:00:00.000Z'
      }
    ]);

    expect(result).toEqual([
      {
        id: 'fb_1',
        selectedText: 'Selected',
        contextBefore: 'Before ',
        contextAfter: ' after',
        headingPath: ['Intro'],
        feedback: 'Review this',
        status: 'open',
        createdAt: '2026-05-31T10:00:00.000Z',
        shifted: false
      }
    ]);
  });
});

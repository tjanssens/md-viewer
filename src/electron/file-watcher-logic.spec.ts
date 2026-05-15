import { shouldReportChange } from './file-watcher-logic';

describe('shouldReportChange', () => {
  it('returns false als now binnen ignoreUntil valt', () => {
    expect(shouldReportChange({
      now: 1000, ignoreUntil: 2000,
      currentMtime: 100, lastKnownMtime: 50
    })).toBe(false);
  });

  it('returns false als mtime gelijk is aan lastKnown', () => {
    expect(shouldReportChange({
      now: 5000, ignoreUntil: 0,
      currentMtime: 100, lastKnownMtime: 100
    })).toBe(false);
  });

  it('returns true bij oudere lastKnown en geen ignore', () => {
    expect(shouldReportChange({
      now: 5000, ignoreUntil: 0,
      currentMtime: 200, lastKnownMtime: 100
    })).toBe(true);
  });

  it('returns true exact op moment ignoreUntil', () => {
    expect(shouldReportChange({
      now: 2000, ignoreUntil: 2000,
      currentMtime: 200, lastKnownMtime: 100
    })).toBe(true);
  });

  it('returns false als ignoreUntil net groter is dan now', () => {
    expect(shouldReportChange({
      now: 1999, ignoreUntil: 2000,
      currentMtime: 200, lastKnownMtime: 100
    })).toBe(false);
  });
});

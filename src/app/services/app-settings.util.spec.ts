import { DEFAULT_SETTINGS, normalizeSettings } from './app-settings.util';

describe('normalizeSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('not settings')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid persisted settings', () => {
    expect(normalizeSettings({
      fontFamily: 'Verdana',
      fontSize: 20,
      editorFontFamily: 'Menlo',
      editorFontSize: 18,
      theme: 'dark'
    })).toEqual({
      fontFamily: 'Verdana',
      fontSize: 20,
      editorFontFamily: 'Menlo',
      editorFontSize: 18,
      theme: 'dark'
    });
  });

  it('falls back for invalid theme and empty font names', () => {
    expect(normalizeSettings({
      fontFamily: '   ',
      editorFontFamily: '',
      theme: 'sepia'
    })).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps unsafe font sizes to readable bounds', () => {
    expect(normalizeSettings({
      fontSize: 200,
      editorFontSize: -2
    })).toEqual({
      ...DEFAULT_SETTINGS,
      fontSize: 48,
      editorFontSize: 10
    });
  });
});

export type Theme = 'auto' | 'light' | 'dark';

export interface AppSettings {
  fontFamily: string;
  fontSize: number;
  editorFontFamily: string;
  editorFontSize: number;
  theme: Theme;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: 'Georgia',
  fontSize: 16,
  editorFontFamily: 'Consolas',
  editorFontSize: 14,
  theme: 'auto'
};

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 48;
const THEMES: Theme[] = ['auto', 'light', 'dark'];

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  return {
    fontFamily: readNonEmptyString(value['fontFamily'], DEFAULT_SETTINGS.fontFamily),
    fontSize: readFontSize(value['fontSize'], DEFAULT_SETTINGS.fontSize),
    editorFontFamily: readNonEmptyString(value['editorFontFamily'], DEFAULT_SETTINGS.editorFontFamily),
    editorFontSize: readFontSize(value['editorFontSize'], DEFAULT_SETTINGS.editorFontSize),
    theme: readTheme(value['theme'], DEFAULT_SETTINGS.theme)
  };
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readFontSize(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

function readTheme(value: unknown, fallback: Theme): Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme)
    ? value as Theme
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

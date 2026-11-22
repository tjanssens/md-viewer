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
const KEY = 'md-viewer-settings';

export function normalizeSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_SETTINGS;
  const v = value as Record<string, unknown>;
  return {
    fontFamily: readNonEmptyString(v['fontFamily'], DEFAULT_SETTINGS.fontFamily),
    fontSize: readFontSize(v['fontSize'], DEFAULT_SETTINGS.fontSize),
    editorFontFamily: readNonEmptyString(v['editorFontFamily'], DEFAULT_SETTINGS.editorFontFamily),
    editorFontSize: readFontSize(v['editorFontSize'], DEFAULT_SETTINGS.editorFontSize),
    theme: typeof v['theme'] === 'string' && THEMES.includes(v['theme'] as Theme) ? (v['theme'] as Theme) : DEFAULT_SETTINGS.theme
  };
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readFontSize(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function resolveTheme(theme: Theme, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'auto') return systemDark ? 'dark' : 'light';
  return theme;
}

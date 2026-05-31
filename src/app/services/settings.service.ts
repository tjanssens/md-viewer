import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  normalizeSettings,
  Theme
} from './app-settings.util';

export type { AppSettings, Theme };

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings = new BehaviorSubject<AppSettings>(this.loadSettings());
  settings$ = this.settings.asObservable();

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem('md-viewer-settings');
      if (stored) {
        return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return DEFAULT_SETTINGS;
  }

  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem('md-viewer-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  getSettings(): AppSettings {
    return this.settings.value;
  }

  updateSettings(partial: Partial<AppSettings>): void {
    const newSettings = normalizeSettings({ ...this.settings.value, ...partial });
    this.settings.next(newSettings);
    this.saveSettings(newSettings);
  }

  setFontFamily(fontFamily: string): void {
    this.updateSettings({ fontFamily });
  }

  setFontSize(fontSize: number): void {
    this.updateSettings({ fontSize });
  }

  setEditorFontFamily(editorFontFamily: string): void {
    this.updateSettings({ editorFontFamily });
  }

  setEditorFontSize(editorFontSize: number): void {
    this.updateSettings({ editorFontSize });
  }

  setTheme(theme: Theme): void {
    this.updateSettings({ theme });
  }
}

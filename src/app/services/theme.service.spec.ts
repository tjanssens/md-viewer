import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { SettingsService } from './settings.service';
import { BehaviorSubject } from 'rxjs';

describe('ThemeService', () => {
  let settingsSubject: BehaviorSubject<any>;
  let mockMediaQueryList: any;
  let originalMatchMedia: any;

  beforeEach(() => {
    settingsSubject = new BehaviorSubject({
      fontFamily: 'Georgia', fontSize: 16,
      editorFontFamily: 'Consolas', editorFontSize: 14,
      theme: 'auto'
    });

    mockMediaQueryList = {
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    originalMatchMedia = window.matchMedia;
    (window as any).matchMedia = jest.fn().mockReturnValue(mockMediaQueryList);

    document.body.className = '';

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: SettingsService, useValue: {
          settings$: settingsSubject.asObservable(),
          getSettings: () => settingsSubject.value
        }}
      ]
    });
  });

  afterEach(() => {
    (window as any).matchMedia = originalMatchMedia;
  });

  it('past theme-light toe op body wanneer auto en systeem light is', () => {
    mockMediaQueryList.matches = false;
    TestBed.inject(ThemeService);
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
  });

  it('past theme-dark toe op body wanneer auto en systeem dark is', () => {
    mockMediaQueryList.matches = true;
    TestBed.inject(ThemeService);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });

  it('respecteert expliciete dark voorkeur ongeacht systeem', () => {
    mockMediaQueryList.matches = false;
    settingsSubject.next({ ...settingsSubject.value, theme: 'dark' });
    TestBed.inject(ThemeService);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });

  it('respecteert expliciete light voorkeur ongeacht systeem', () => {
    mockMediaQueryList.matches = true;
    settingsSubject.next({ ...settingsSubject.value, theme: 'light' });
    TestBed.inject(ThemeService);
    expect(document.body.classList.contains('theme-light')).toBe(true);
  });

  it('reageert op settings wijziging', () => {
    mockMediaQueryList.matches = false;
    TestBed.inject(ThemeService);
    expect(document.body.classList.contains('theme-light')).toBe(true);
    settingsSubject.next({ ...settingsSubject.value, theme: 'dark' });
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });
});

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { SettingsService, Theme } from './settings.service';

export type EffectiveTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private systemDark = new BehaviorSubject<boolean>(this.detectSystemDark());
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private mediaListener = (e: MediaQueryListEvent) => this.systemDark.next(e.matches);
  private subscription: Subscription;

  effectiveTheme$ = combineLatest([
    this.settingsService.settings$,
    this.systemDark
  ]).pipe(
    map(([settings, systemDark]) => this.resolveTheme(settings.theme, systemDark)),
    distinctUntilChanged()
  );

  constructor(private settingsService: SettingsService) {
    this.mediaQuery.addEventListener('change', this.mediaListener);
    this.subscription = this.effectiveTheme$.subscribe(theme => this.applyToBody(theme));
  }

  ngOnDestroy(): void {
    this.mediaQuery.removeEventListener('change', this.mediaListener);
    this.subscription.unsubscribe();
  }

  private detectSystemDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private resolveTheme(theme: Theme, systemDark: boolean): EffectiveTheme {
    if (theme === 'auto') return systemDark ? 'dark' : 'light';
    return theme;
  }

  private applyToBody(theme: EffectiveTheme): void {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
  }
}

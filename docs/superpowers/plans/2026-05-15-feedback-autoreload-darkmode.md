# Feedback, Auto-reload en Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drie features aan de bestaande Markdown viewer toevoegen: dark mode (auto/light/dark), feedback annotaties met clipboard export naar Claude, en auto-reload bij externe wijziging.

**Architecture:** Drie fases, in deze volgorde — eerst dark mode (raakt CSS overal), dan feedback (zelfstandige Angular feature met service + components), dan auto-reload (Electron file watcher + UI toast). Persistence via localStorage per filePath voor feedback en globaal voor settings. CSS variables voor theming.

**Tech Stack:** Angular 17 standalone components, Electron 28, TypeScript 5.3, marked + highlight.js. Tests via **Jest** + `jest-preset-angular` (Task 0 zet het op). Test scope: nieuwe utilities, services en testbare Electron logica via TDD. UI components met DOM-selectie API blijven manual verify (jsdom is daar te beperkt voor). Bestaande code (markdown.service, settings.service vóór deze plan) wordt niet retro-actief getest.

**Spec:** `docs/superpowers/specs/2026-05-15-feedback-autoreload-darkmode-design.md`

---

## File structure overzicht

### Te creëren

- `src/app/services/theme.service.ts`
- `src/app/services/feedback.service.ts`
- `src/app/services/feedback-anchor.util.ts`
- `src/app/services/heading-path.util.ts`
- `src/app/components/feedback-popover/feedback-popover.component.ts`
- `src/app/components/feedback-sidebar/feedback-sidebar.component.ts`
- `src/app/components/reload-toast/reload-toast.component.ts`
- `src/app/components/reload-conflict-modal/reload-conflict-modal.component.ts`

### Te wijzigen

- `src/styles.css` — CSS variables, theme classes
- `src/app/services/settings.service.ts` — `theme` veld
- `src/app/services/electron.service.ts` — `fileChangedExternally$` observable
- `src/app/components/markdown-viewer/markdown-viewer.component.ts` — CSS vars, selectie detectie, highlight rendering
- `src/app/components/markdown-editor/markdown-editor.component.ts` — CSS vars
- `src/app/components/toolbar/toolbar.component.ts` — CSS vars, theme dropdown, feedback toggle
- `src/app/components/split-pane/split-pane.component.ts` — CSS vars
- `src/app/app.component.ts` — body class via ThemeService, sidebar/toast/modal integratie
- `src/electron/main.ts` — fs.watch met debounce + ignore-save vlag
- `src/electron/preload.ts` — `onFileChangedExternally` listener

---

# Fase 0 — Test framework setup

## Task 0.1: Installeer Jest met jest-preset-angular

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `setup-jest.ts`
- Create: `tsconfig.spec.json`

- [ ] **Step 1: Installeer dependencies**

Run:
```bash
npm install --save-dev jest @types/jest jest-preset-angular @testing-library/jasmine-dom
```

Expected: dependencies geïnstalleerd zonder errors.

- [ ] **Step 2: Maak jest.config.js**

Schrijf naar `jest.config.js`:

```javascript
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEach: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/release/'],
  testMatch: ['**/?(*.)+(spec).ts'],
  moduleFileExtensions: ['ts', 'js', 'html', 'json'],
  transform: {
    '^.+\\.(ts|js|html)$': [
      'jest-preset-angular',
      { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.html$' }
    ]
  }
};
```

- [ ] **Step 3: Maak setup-jest.ts**

Schrijf naar `setup-jest.ts`:

```typescript
import 'jest-preset-angular/setup-jest';
```

- [ ] **Step 4: Maak tsconfig.spec.json**

Schrijf naar `tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest", "node"],
    "esModuleInterop": true
  },
  "include": [
    "src/**/*.spec.ts",
    "src/**/*.d.ts",
    "setup-jest.ts"
  ]
}
```

- [ ] **Step 5: Voeg test script toe aan package.json**

Open `package.json` en voeg toe aan de `scripts` sectie:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Maak een sanity test**

Schrijf naar `src/sanity.spec.ts`:

```typescript
describe('Jest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run de test**

Run: `npm test`
Expected: 1 test passes ("Jest setup runs"). Geen errors.

- [ ] **Step 8: Verwijder sanity test en commit**

```bash
rm src/sanity.spec.ts
git add package.json package-lock.json jest.config.js setup-jest.ts tsconfig.spec.json
git commit -m "chore(test): add Jest with jest-preset-angular"
```

---

# Fase 1 — Dark Mode

## Task 1.1: Theme veld toevoegen aan SettingsService

**Files:**
- Modify: `src/app/services/settings.service.ts`

- [ ] **Step 1: Voeg theme veld toe aan AppSettings interface en DEFAULT_SETTINGS**

Open `src/app/services/settings.service.ts` en vervang de interface + defaults:

```typescript
export type Theme = 'auto' | 'light' | 'dark';

export interface AppSettings {
  fontFamily: string;
  fontSize: number;
  editorFontFamily: string;
  editorFontSize: number;
  theme: Theme;
}

const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: 'Georgia',
  fontSize: 16,
  editorFontFamily: 'Consolas',
  editorFontSize: 14,
  theme: 'auto'
};
```

- [ ] **Step 2: Voeg setTheme methode toe**

Voeg onderaan de class toe (vóór de sluitende `}`):

```typescript
  setTheme(theme: Theme): void {
    this.updateSettings({ theme });
  }
```

- [ ] **Step 3: Build check**

Run: `npm run build:angular`
Expected: succesvolle build zonder errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/services/settings.service.ts
git commit -m "feat(settings): add theme field with auto/light/dark options"
```

---

## Task 1.2: ThemeService aanmaken

**Files:**
- Create: `src/app/services/theme.service.ts`
- Create: `src/app/services/theme.service.spec.ts`

- [ ] **Step 1: Schrijf falende test eerst**

Schrijf naar `src/app/services/theme.service.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test, verifieer dat hij faalt**

Run: `npm test -- theme.service`
Expected: FAIL — `Cannot find module './theme.service'`.

- [ ] **Step 3: Maak het bestand**

Schrijf naar `src/app/services/theme.service.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests, verifieer slagen**

Run: `npm test -- theme.service`
Expected: 5 tests pass.

- [ ] **Step 5: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/theme.service.ts src/app/services/theme.service.spec.ts
git commit -m "feat(theme): add ThemeService with auto system-preference detection"
```

---

## Task 1.3: CSS variables en theme classes in styles.css

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Lees huidige styles.css**

Open `src/styles.css` en bekijk huidige inhoud (zou minimaal moeten zijn).

- [ ] **Step 2: Vervang volledige inhoud**

Schrijf naar `src/styles.css`:

```css
/* Theme tokens — light (default) */
:root, body.theme-light {
  --color-bg: #ffffff;
  --color-bg-elevated: #f6f8fa;
  --color-bg-welcome: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  --color-text: #24292e;
  --color-text-muted: #6a737d;
  --color-text-subtle: #adb5bd;
  --color-heading: #343a40;
  --color-border: #e9ecef;
  --color-border-strong: #dfe2e5;
  --color-link: #0366d6;
  --color-code-bg: rgba(27, 31, 35, 0.05);
  --color-pre-bg: #f6f8fa;
  --color-blockquote: #6a737d;
  --color-table-stripe: #f6f8fa;
  --color-primary: #0d6efd;
  --color-primary-hover: #0b5ed7;
  --color-feedback-highlight: rgba(255, 220, 0, 0.45);
  --color-feedback-highlight-processed: rgba(160, 160, 160, 0.35);
  --color-feedback-highlight-flash: rgba(255, 150, 0, 0.75);
  --color-toast-bg: #fff3cd;
  --color-toast-text: #664d03;
  --color-toast-border: #ffe69c;
  --color-modal-overlay: rgba(0, 0, 0, 0.5);
}

body.theme-dark {
  --color-bg: #0d1117;
  --color-bg-elevated: #161b22;
  --color-bg-welcome: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  --color-text: #c9d1d9;
  --color-text-muted: #8b949e;
  --color-text-subtle: #6e7681;
  --color-heading: #f0f6fc;
  --color-border: #30363d;
  --color-border-strong: #30363d;
  --color-link: #58a6ff;
  --color-code-bg: rgba(110, 118, 129, 0.4);
  --color-pre-bg: #161b22;
  --color-blockquote: #8b949e;
  --color-table-stripe: #161b22;
  --color-primary: #1f6feb;
  --color-primary-hover: #388bfd;
  --color-feedback-highlight: rgba(210, 153, 34, 0.5);
  --color-feedback-highlight-processed: rgba(110, 118, 129, 0.4);
  --color-feedback-highlight-flash: rgba(255, 150, 0, 0.75);
  --color-toast-bg: #3d2e00;
  --color-toast-text: #ffd33d;
  --color-toast-border: #5a4700;
  --color-modal-overlay: rgba(0, 0, 0, 0.7);
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

- [ ] **Step 3: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat(theme): add CSS variables for light and dark themes"
```

---

## Task 1.4: ThemeService initialiseren in AppComponent

**Files:**
- Modify: `src/app/app.component.ts`

- [ ] **Step 1: Injecteer ThemeService**

Open `src/app/app.component.ts`. Voeg import toe bovenaan:

```typescript
import { ThemeService } from './services/theme.service';
```

In de constructor, voeg `ThemeService` toe (de service moet geïnstantieerd worden om effect te hebben):

```typescript
  constructor(
    private electronService: ElectronService,
    private settingsService: SettingsService,
    private themeService: ThemeService
  ) {}
```

- [ ] **Step 2: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 3: Manual verify**

Run: `npm start`
Expected: app start, body krijgt class `theme-light` of `theme-dark` afhankelijk van systeem. Check via DevTools: `document.body.classList`.

- [ ] **Step 4: Commit**

```bash
git add src/app/app.component.ts
git commit -m "feat(theme): bootstrap ThemeService in AppComponent"
```

---

## Task 1.5: Refactor AppComponent styles naar CSS variables

**Files:**
- Modify: `src/app/app.component.ts`

- [ ] **Step 1: Vervang inline styles**

In `src/app/app.component.ts`, vervang de `styles: [...]` array met:

```typescript
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--color-bg);
      color: var(--color-text);
    }

    .main-content {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .view-mode, .edit-mode {
      height: 100%;
    }

    .full-viewer, .preview-viewer {
      height: 100%;
    }

    .preview-viewer {
      background: var(--color-bg);
      border-left: 1px solid var(--color-border);
    }

    .welcome-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-welcome);
    }

    .welcome-content {
      text-align: center;
      padding: 48px;
    }

    .welcome-content h1 {
      font-size: 48px;
      font-weight: 300;
      color: var(--color-heading);
      margin: 0 0 16px;
    }

    .welcome-content p {
      font-size: 18px;
      color: var(--color-text-muted);
      margin: 0 0 32px;
    }

    .welcome-btn {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 32px;
      font-size: 18px;
      font-weight: 500;
      color: #ffffff;
      background: var(--color-primary);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .welcome-btn:hover {
      background: var(--color-primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
    }

    .welcome-btn .icon {
      font-size: 24px;
    }

    .hint {
      margin-top: 24px !important;
      font-size: 14px !important;
      color: var(--color-text-subtle) !important;
    }
  `]
```

- [ ] **Step 2: Build + manual verify**

Run: `npm start`
Expected: welcome screen ziet er goed uit in zowel light als dark (test door systeem theme te wisselen of via DevTools `document.body.classList.toggle('theme-dark')`).

- [ ] **Step 3: Commit**

```bash
git add src/app/app.component.ts
git commit -m "refactor(theme): app.component styles use CSS variables"
```

---

## Task 1.6: Refactor MarkdownViewerComponent styles

**Files:**
- Modify: `src/app/components/markdown-viewer/markdown-viewer.component.ts`

- [ ] **Step 1: Vervang styles array**

In `src/app/components/markdown-viewer/markdown-viewer.component.ts`, vervang de complete `styles: [...]` met:

```typescript
  styles: [`
    .markdown-viewer {
      height: 100%;
      overflow-y: auto;
      padding: 32px 48px;
      line-height: 1.7;
      color: var(--color-text);
      background: var(--color-bg);
    }

    :host ::ng-deep h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 0.67em 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-heading);
    }

    :host ::ng-deep h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 1em 0 0.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-heading);
    }

    :host ::ng-deep h3, :host ::ng-deep h4, :host ::ng-deep h5, :host ::ng-deep h6 {
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--color-heading);
    }

    :host ::ng-deep h3 { font-size: 1.25em; }

    :host ::ng-deep p {
      margin: 0 0 16px;
    }

    :host ::ng-deep a {
      color: var(--color-link);
      text-decoration: none;
    }

    :host ::ng-deep a:hover {
      text-decoration: underline;
    }

    :host ::ng-deep code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      background-color: var(--color-code-bg);
      border-radius: 3px;
    }

    :host ::ng-deep pre {
      background-color: var(--color-pre-bg);
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin: 0 0 16px;
    }

    :host ::ng-deep pre code {
      background: none;
      padding: 0;
      font-size: 0.875em;
      line-height: 1.45;
    }

    :host ::ng-deep blockquote {
      margin: 0 0 16px;
      padding: 0 1em;
      color: var(--color-blockquote);
      border-left: 4px solid var(--color-border-strong);
    }

    :host ::ng-deep ul, :host ::ng-deep ol {
      margin: 0 0 16px;
      padding-left: 2em;
    }

    :host ::ng-deep li {
      margin: 0.25em 0;
    }

    :host ::ng-deep table {
      border-collapse: collapse;
      margin: 0 0 16px;
      width: 100%;
    }

    :host ::ng-deep th, :host ::ng-deep td {
      border: 1px solid var(--color-border-strong);
      padding: 8px 12px;
    }

    :host ::ng-deep th {
      background-color: var(--color-bg-elevated);
      font-weight: 600;
    }

    :host ::ng-deep tr:nth-child(even) {
      background-color: var(--color-table-stripe);
    }

    :host ::ng-deep img {
      max-width: 100%;
      height: auto;
    }

    :host ::ng-deep hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 24px 0;
    }

    :host ::ng-deep .hljs {
      background: transparent;
    }

    :host ::ng-deep .feedback-highlight {
      background-color: var(--color-feedback-highlight);
      border-radius: 2px;
      padding: 0 2px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    :host ::ng-deep .feedback-highlight.processed {
      background-color: var(--color-feedback-highlight-processed);
      text-decoration: line-through;
      opacity: 0.7;
    }

    :host ::ng-deep .feedback-highlight.flash {
      background-color: var(--color-feedback-highlight-flash);
    }
  `]
```

- [ ] **Step 2: Manual verify**

Run: `npm start`, open een markdown bestand. Wissel `document.body.classList.toggle('theme-dark')` in DevTools.
Expected: viewer past tekst, headings, code, tables, blockquotes aan.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/markdown-viewer/markdown-viewer.component.ts
git commit -m "refactor(theme): markdown-viewer styles use CSS variables"
```

---

## Task 1.7: Refactor MarkdownEditorComponent en SplitPaneComponent

**Files:**
- Modify: `src/app/components/markdown-editor/markdown-editor.component.ts`
- Modify: `src/app/components/split-pane/split-pane.component.ts`

- [ ] **Step 1: Lees markdown-editor.component.ts**

Open `src/app/components/markdown-editor/markdown-editor.component.ts`.

- [ ] **Step 2: Vervang hardcoded kleuren in markdown-editor styles**

Vervang alle voorkomende hardcoded kleuren in de `styles: [...]` array volgens deze mapping:
- `#ffffff` (achtergrond) → `var(--color-bg)`
- `#f6f8fa`, `#f5f5f5` → `var(--color-bg-elevated)`
- `#24292e`, `#000`, `#333` (tekst) → `var(--color-text)`
- `#6a737d`, `#999` (muted) → `var(--color-text-muted)`
- `#e9ecef`, `#ddd`, `#eaecef` (borders) → `var(--color-border)`

Voeg `background: var(--color-bg); color: var(--color-text);` toe aan het editor root element selector (zoals `.editor-container` of `.markdown-editor`).

- [ ] **Step 3: Lees split-pane.component.ts**

Open `src/app/components/split-pane/split-pane.component.ts`.

- [ ] **Step 4: Vervang hardcoded kleuren in split-pane**

Vervang in de `styles: [...]` array:
- Divider/handle achtergrond → `var(--color-border)`
- Hover staat → `var(--color-border-strong)`
- Panel achtergrond → `var(--color-bg)`

- [ ] **Step 5: Manual verify**

Run: `npm start`, open een bestand, toggle edit mode, switch dark mode.
Expected: editor en split-pane volgen het thema.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/markdown-editor/markdown-editor.component.ts src/app/components/split-pane/split-pane.component.ts
git commit -m "refactor(theme): editor and split-pane use CSS variables"
```

---

## Task 1.8: Theme dropdown in ToolbarComponent

**Files:**
- Modify: `src/app/components/toolbar/toolbar.component.ts`

- [ ] **Step 1: Lees huidige toolbar.component.ts**

Open `src/app/components/toolbar/toolbar.component.ts` om bestaande structuur te bekijken.

- [ ] **Step 2: Voeg imports en injection toe**

Voeg bovenaan in imports toe:

```typescript
import { FormsModule } from '@angular/forms';
import { SettingsService, Theme } from '../../services/settings.service';
```

In `@Component({ imports: [...] })`, voeg `FormsModule` toe.

In constructor, voeg toe:

```typescript
  constructor(public settingsService: SettingsService) {}

  get currentTheme(): Theme {
    return this.settingsService.getSettings().theme;
  }

  setTheme(theme: Theme): void {
    this.settingsService.setTheme(theme);
  }
```

- [ ] **Step 3: Voeg theme dropdown UI toe**

In de toolbar template (binnen `template: \`...\``), voeg vóór de sluitende toolbar div een dropdown toe:

```html
<div class="theme-selector">
  <button class="theme-btn" [title]="'Thema: ' + currentTheme">🌓</button>
  <div class="theme-menu">
    <button (click)="setTheme('auto')" [class.active]="currentTheme === 'auto'">Auto</button>
    <button (click)="setTheme('light')" [class.active]="currentTheme === 'light'">Licht</button>
    <button (click)="setTheme('dark')" [class.active]="currentTheme === 'dark'">Donker</button>
  </div>
</div>
```

- [ ] **Step 4: Voeg styles toe voor theme selector**

Voeg aan de bestaande `styles: [...]` array binnen toolbar de volgende regels toe (vóór het sluitende `\``):

```css
.theme-selector {
  position: relative;
  display: inline-block;
}

.theme-selector:hover .theme-menu,
.theme-selector:focus-within .theme-menu {
  display: flex;
}

.theme-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-text);
}

.theme-btn:hover {
  background: var(--color-bg-elevated);
}

.theme-menu {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  flex-direction: column;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 120px;
}

.theme-menu button {
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  font-size: 14px;
}

.theme-menu button:hover {
  background: var(--color-bg-elevated);
}

.theme-menu button.active {
  background: var(--color-primary);
  color: white;
}
```

Refactor ook de overige toolbar styles om CSS variables te gebruiken (vervang hardcoded backgrounds/borders/text colors zoals in vorige tasks).

- [ ] **Step 5: Manual verify**

Run: `npm start`
Expected: toolbar toont 🌓 knop rechts. Hover/click toont dropdown met 3 opties. Klikken op een optie:
- Wijzigt body class (`theme-light` / `theme-dark`)
- Wordt bewaard in localStorage (`md-viewer-settings`)
- Bij Auto: volgt systeem voorkeur

- [ ] **Step 6: Commit**

```bash
git add src/app/components/toolbar/toolbar.component.ts
git commit -m "feat(theme): add theme selector dropdown in toolbar"
```

---

## Task 1.9: Highlight.js dual theme

**Files:**
- Modify: `src/app/services/markdown.service.ts` (mogelijk)
- Modify: `src/index.html` of `src/styles.css`

- [ ] **Step 1: Check huidige hljs setup**

Open `src/app/services/markdown.service.ts` om te zien hoe highlight.js geladen wordt.

- [ ] **Step 2: Voeg beide highlight thema's toe aan styles.css**

Append onderaan `src/styles.css`:

```css
/* Highlight.js light theme (GitHub) */
body.theme-light .hljs { color: #24292e; }
body.theme-light .hljs-comment, body.theme-light .hljs-quote { color: #6a737d; }
body.theme-light .hljs-keyword, body.theme-light .hljs-selector-tag, body.theme-light .hljs-section { color: #d73a49; }
body.theme-light .hljs-string, body.theme-light .hljs-attr, body.theme-light .hljs-template-tag { color: #032f62; }
body.theme-light .hljs-number, body.theme-light .hljs-literal { color: #005cc5; }
body.theme-light .hljs-built_in, body.theme-light .hljs-type { color: #e36209; }
body.theme-light .hljs-function .hljs-title, body.theme-light .hljs-title.function_ { color: #6f42c1; }
body.theme-light .hljs-variable, body.theme-light .hljs-name { color: #e36209; }

/* Highlight.js dark theme (GitHub Dark) */
body.theme-dark .hljs { color: #c9d1d9; }
body.theme-dark .hljs-comment, body.theme-dark .hljs-quote { color: #8b949e; }
body.theme-dark .hljs-keyword, body.theme-dark .hljs-selector-tag, body.theme-dark .hljs-section { color: #ff7b72; }
body.theme-dark .hljs-string, body.theme-dark .hljs-attr, body.theme-dark .hljs-template-tag { color: #a5d6ff; }
body.theme-dark .hljs-number, body.theme-dark .hljs-literal { color: #79c0ff; }
body.theme-dark .hljs-built_in, body.theme-dark .hljs-type { color: #ffa657; }
body.theme-dark .hljs-function .hljs-title, body.theme-dark .hljs-title.function_ { color: #d2a8ff; }
body.theme-dark .hljs-variable, body.theme-dark .hljs-name { color: #ffa657; }
```

- [ ] **Step 3: Verwijder hardcoded hljs theme import indien aanwezig**

Als `markdown.service.ts` een `import 'highlight.js/styles/...'` regel heeft, verwijder die (we doen het via CSS variables nu).

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 4: Manual verify**

Run: `npm start`, open een markdown met code blocks, wissel thema.
Expected: code highlighting kleurt mee met thema.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/app/services/markdown.service.ts
git commit -m "feat(theme): dual highlight.js theme switching with body class"
```

---

# Fase 2 — Feedback annotaties

## Task 2.1: FeedbackItem types en FeedbackService basis

**Files:**
- Create: `src/app/services/feedback.service.ts`
- Create: `src/app/services/feedback.service.spec.ts`

- [ ] **Step 1: Schrijf falende tests eerst**

Schrijf naar `src/app/services/feedback.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { FeedbackService, FeedbackItem } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [FeedbackService] });
    service = TestBed.inject(FeedbackService);
  });

  const sampleInput = {
    selectedText: 'belangrijk',
    contextBefore: 'voor ',
    contextAfter: ' staat',
    headingPath: ['Intro', 'Setup'],
    feedback: 'mijn opmerking'
  };

  it('start met lege lijst', () => {
    service.setCurrentFile('/test.md');
    expect(service.getItems()).toEqual([]);
  });

  it('voegt item toe met status open en gegenereerde id', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    expect(added.id).toBeDefined();
    expect(added.status).toBe('open');
    expect(added.createdAt).toBeDefined();
    expect(service.getItems().length).toBe(1);
  });

  it('persisteert per filePath in localStorage', () => {
    service.setCurrentFile('/a.md');
    service.add(sampleInput);
    service.setCurrentFile('/b.md');
    expect(service.getItems()).toEqual([]);
    service.add({ ...sampleInput, feedback: 'andere' });
    expect(service.getItems().length).toBe(1);
    service.setCurrentFile('/a.md');
    expect(service.getItems().length).toBe(1);
    expect(service.getItems()[0].feedback).toBe('mijn opmerking');
  });

  it('update wijzigt een specifiek item', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    service.update(added.id, { status: 'processed' });
    expect(service.getItems()[0].status).toBe('processed');
  });

  it('remove verwijdert een specifiek item', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    service.remove(added.id);
    expect(service.getItems()).toEqual([]);
  });

  it('removeByStatus verwijdert alleen items met die status', () => {
    service.setCurrentFile('/test.md');
    const a = service.add(sampleInput);
    const b = service.add(sampleInput);
    service.update(a.id, { status: 'processed' });
    service.removeByStatus('processed');
    expect(service.getItems().length).toBe(1);
    expect(service.getItems()[0].id).toBe(b.id);
  });

  it('emit items$ bij elke wijziging', (done) => {
    service.setCurrentFile('/test.md');
    const emissions: FeedbackItem[][] = [];
    service.items$.subscribe(items => {
      emissions.push(items);
      if (emissions.length === 3) {
        expect(emissions[0].length).toBe(0);
        expect(emissions[1].length).toBe(1);
        expect(emissions[2].length).toBe(0);
        done();
      }
    });
    const added = service.add(sampleInput);
    service.remove(added.id);
  });

  it('herlaadt opgeslagen items bij setCurrentFile', () => {
    service.setCurrentFile('/test.md');
    service.add(sampleInput);
    const service2 = new FeedbackService();
    service2.setCurrentFile('/test.md');
    expect(service2.getItems().length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verifieer dat hij faalt**

Run: `npm test -- feedback.service`
Expected: FAIL — `Cannot find module './feedback.service'`.

- [ ] **Step 3: Maak feedback.service.ts**

Schrijf naar `src/app/services/feedback.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FeedbackStatus = 'open' | 'processed' | 'orphaned';

export interface FeedbackItem {
  id: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  headingPath: string[];
  feedback: string;
  status: FeedbackStatus;
  createdAt: string;
  shifted?: boolean;
}

const STORAGE_PREFIX = 'feedback:';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private currentFilePath: string | null = null;
  private itemsSubject = new BehaviorSubject<FeedbackItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  setCurrentFile(filePath: string | null): void {
    this.currentFilePath = filePath;
    this.itemsSubject.next(this.loadItems());
  }

  add(item: Omit<FeedbackItem, 'id' | 'createdAt' | 'status'>): FeedbackItem {
    const newItem: FeedbackItem = {
      ...item,
      id: this.generateId(),
      status: 'open',
      createdAt: new Date().toISOString()
    };
    const updated = [...this.itemsSubject.value, newItem];
    this.persist(updated);
    return newItem;
  }

  update(id: string, changes: Partial<FeedbackItem>): void {
    const updated = this.itemsSubject.value.map(item =>
      item.id === id ? { ...item, ...changes } : item
    );
    this.persist(updated);
  }

  remove(id: string): void {
    const updated = this.itemsSubject.value.filter(item => item.id !== id);
    this.persist(updated);
  }

  removeByStatus(status: FeedbackStatus): void {
    const updated = this.itemsSubject.value.filter(item => item.status !== status);
    this.persist(updated);
  }

  replaceAll(items: FeedbackItem[]): void {
    this.persist(items);
  }

  getItems(): FeedbackItem[] {
    return this.itemsSubject.value;
  }

  private generateId(): string {
    return 'fb_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }

  private loadItems(): FeedbackItem[] {
    if (!this.currentFilePath) return [];
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + this.currentFilePath);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading feedback:', error);
      return [];
    }
  }

  private persist(items: FeedbackItem[]): void {
    this.itemsSubject.next(items);
    if (!this.currentFilePath) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + this.currentFilePath, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  }
}
```

- [ ] **Step 4: Run tests, verifieer slagen**

Run: `npm test -- feedback.service`
Expected: 8 tests pass.

- [ ] **Step 5: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/feedback.service.ts src/app/services/feedback.service.spec.ts
git commit -m "feat(feedback): add FeedbackService with localStorage per file"
```

---

## Task 2.2: Heading path utility

**Files:**
- Create: `src/app/services/heading-path.util.ts`
- Create: `src/app/services/heading-path.util.spec.ts`

- [ ] **Step 1: Schrijf falende tests eerst**

Schrijf naar `src/app/services/heading-path.util.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, verifieer falen**

Run: `npm test -- heading-path`
Expected: FAIL — `Cannot find module './heading-path.util'`.

- [ ] **Step 3: Schrijf de utility**

Schrijf naar `src/app/services/heading-path.util.ts`:

```typescript
/**
 * Bepaalt het heading-pad voor een DOM node binnen een gerenderde markdown viewer.
 * Loopt door alle voorgaande heading siblings/ancestors en bouwt een hiërarchisch pad.
 *
 * Voorbeeld: voor een paragraph onder "Installatie" wat onder "Introductie" valt,
 * returns ['Introductie', 'Installatie'].
 */
export function getHeadingPath(node: Node, root: HTMLElement): string[] {
  const headings: { level: number; text: string }[] = [];
  const allHeadings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];

  const targetElement = node.nodeType === Node.ELEMENT_NODE
    ? node as HTMLElement
    : node.parentElement;
  if (!targetElement) return [];

  for (const heading of allHeadings) {
    const position = heading.compareDocumentPosition(targetElement);
    const isBefore = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      || heading === targetElement
      || heading.contains(targetElement);
    if (!isBefore) continue;
    if (heading === targetElement || heading.contains(targetElement)) continue;

    const level = parseInt(heading.tagName.charAt(1), 10);
    const text = heading.textContent?.trim() || '';

    while (headings.length > 0 && headings[headings.length - 1].level >= level) {
      headings.pop();
    }
    headings.push({ level, text });
  }

  return headings.map(h => h.text);
}
```

- [ ] **Step 4: Run tests, verifieer slagen**

Run: `npm test -- heading-path`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/heading-path.util.ts src/app/services/heading-path.util.spec.ts
git commit -m "feat(feedback): add heading-path utility for annotation context"
```

---

## Task 2.3: Feedback anchor utility

**Files:**
- Create: `src/app/services/feedback-anchor.util.ts`
- Create: `src/app/services/feedback-anchor.util.spec.ts`

- [ ] **Step 1: Schrijf falende tests eerst**

Schrijf naar `src/app/services/feedback-anchor.util.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, verifieer falen**

Run: `npm test -- feedback-anchor`
Expected: FAIL — `Cannot find module './feedback-anchor.util'`.

- [ ] **Step 3: Schrijf de utility**

Schrijf naar `src/app/services/feedback-anchor.util.ts`:

```typescript
import { FeedbackItem, FeedbackStatus } from './feedback.service';

export interface AnchorResult {
  matchType: 'exact' | 'fuzzy' | 'none';
  startIndex: number;
  endIndex: number;
}

/**
 * Zoekt een feedback item terug in tekst.
 * - exact: contextBefore + selectedText + contextAfter aanwezig
 * - fuzzy: alleen selectedText aanwezig
 * - none: niets gevonden
 *
 * text: de plain text van de gerenderde markdown viewer (textContent)
 */
export function findAnchor(item: FeedbackItem, text: string): AnchorResult {
  const fullPattern = item.contextBefore + item.selectedText + item.contextAfter;
  const exactIdx = text.indexOf(fullPattern);
  if (exactIdx >= 0) {
    return {
      matchType: 'exact',
      startIndex: exactIdx + item.contextBefore.length,
      endIndex: exactIdx + item.contextBefore.length + item.selectedText.length
    };
  }

  const fuzzyIdx = text.indexOf(item.selectedText);
  if (fuzzyIdx >= 0) {
    return {
      matchType: 'fuzzy',
      startIndex: fuzzyIdx,
      endIndex: fuzzyIdx + item.selectedText.length
    };
  }

  return { matchType: 'none', startIndex: -1, endIndex: -1 };
}

/**
 * Bepaalt nieuwe status + shifted vlag op basis van match.
 * - exact match: status onveranderd, shifted=false
 * - fuzzy match: status onveranderd, shifted=true
 * - geen match: status wordt 'orphaned', shifted=false
 */
export function resolveStatus(
  item: FeedbackItem,
  match: AnchorResult
): { status: FeedbackStatus; shifted: boolean } {
  if (match.matchType === 'exact') {
    return {
      status: item.status === 'orphaned' ? 'open' : item.status,
      shifted: false
    };
  }
  if (match.matchType === 'fuzzy') {
    return {
      status: item.status === 'orphaned' ? 'open' : item.status,
      shifted: true
    };
  }
  return { status: 'orphaned', shifted: false };
}
```

- [ ] **Step 4: Run tests, verifieer slagen**

Run: `npm test -- feedback-anchor`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/feedback-anchor.util.ts src/app/services/feedback-anchor.util.spec.ts
git commit -m "feat(feedback): add anchor utility with exact/fuzzy/none matching"
```

---

## Task 2.4: FeedbackPopoverComponent

**Files:**
- Create: `src/app/components/feedback-popover/feedback-popover.component.ts`

- [ ] **Step 1: Maak component**

Schrijf naar `src/app/components/feedback-popover/feedback-popover.component.ts`:

```typescript
import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-feedback-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="popover" [style.top.px]="top" [style.left.px]="left">
      <div class="popover-snippet">"{{ snippet }}"</div>
      <textarea
        #ta
        [(ngModel)]="text"
        placeholder="Schrijf je feedback…"
        rows="4"
        (keydown.escape)="onCancel()"
        (keydown.control.enter)="onSave()"
        (keydown.meta.enter)="onSave()">
      </textarea>
      <div class="popover-actions">
        <button class="btn-cancel" (click)="onCancel()">Annuleren</button>
        <button class="btn-save" (click)="onSave()" [disabled]="!text.trim()">Opslaan</button>
      </div>
    </div>
  `,
  styles: [`
    .popover {
      position: fixed;
      width: 320px;
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      padding: 12px;
      z-index: 1000;
    }
    .popover-snippet {
      font-style: italic;
      color: var(--color-text-muted);
      font-size: 12px;
      margin-bottom: 8px;
      max-height: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 8px;
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }
    .popover-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
    }
    button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      cursor: pointer;
      font-size: 14px;
      background: var(--color-bg);
      color: var(--color-text);
    }
    button:hover:not(:disabled) {
      background: var(--color-bg-elevated);
    }
    .btn-save {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-save:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class FeedbackPopoverComponent implements AfterViewInit {
  @Input() top = 0;
  @Input() left = 0;
  @Input() snippet = '';
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('ta') textareaRef!: ElementRef<HTMLTextAreaElement>;

  text = '';

  ngAfterViewInit(): void {
    setTimeout(() => this.textareaRef.nativeElement.focus(), 0);
  }

  onSave(): void {
    if (!this.text.trim()) return;
    this.save.emit(this.text.trim());
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/feedback-popover/feedback-popover.component.ts
git commit -m "feat(feedback): add FeedbackPopoverComponent"
```

---

## Task 2.5: Selectie detectie en floating button in MarkdownViewerComponent

**Files:**
- Modify: `src/app/components/markdown-viewer/markdown-viewer.component.ts`

- [ ] **Step 1: Voeg imports en outputs toe**

Bovenaan `markdown-viewer.component.ts`, vervang imports met:

```typescript
import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, Output, EventEmitter, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownService } from '../../services/markdown.service';
import { SettingsService } from '../../services/settings.service';
import { FeedbackService, FeedbackItem } from '../../services/feedback.service';
import { findAnchor, resolveStatus } from '../../services/feedback-anchor.util';
import { getHeadingPath } from '../../services/heading-path.util';
```

- [ ] **Step 2: Voeg state + outputs toe in component class**

In de class body, voeg toe (boven de constructor):

```typescript
  @Output() requestFeedback = new EventEmitter<{
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
    rect: { top: number; left: number; bottom: number };
  }>();

  showSelectionButton = false;
  selectionButtonTop = 0;
  selectionButtonLeft = 0;

  private pendingSelection: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
  } | null = null;
```

- [ ] **Step 3: Inject FeedbackService in constructor**

```typescript
  constructor(
    private markdownService: MarkdownService,
    private settingsService: SettingsService,
    private feedbackService: FeedbackService
  ) {
    this.settingsService.settings$.subscribe(settings => {
      this.fontFamily = settings.fontFamily;
      this.fontSize = settings.fontSize;
    });
  }
```

- [ ] **Step 4: Voeg selectie handler methods toe**

Onderaan de class (vóór sluitende `}`), voeg toe:

```typescript
  onMouseUp(): void {
    setTimeout(() => this.handleSelection(), 0);
  }

  private handleSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !this.viewerRef) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }
    const range = selection.getRangeAt(0);
    const root = this.viewerRef.nativeElement;
    if (!root.contains(range.commonAncestorContainer)) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }

    const selectedText = selection.toString();
    if (selectedText.trim().length === 0) {
      this.showSelectionButton = false;
      this.pendingSelection = null;
      return;
    }

    const rootText = root.textContent || '';
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(root);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const beforeText = beforeRange.toString();
    const selectionStart = beforeText.length;

    const contextBefore = rootText.slice(Math.max(0, selectionStart - 50), selectionStart);
    const contextAfter = rootText.slice(
      selectionStart + selectedText.length,
      selectionStart + selectedText.length + 50
    );
    const headingPath = getHeadingPath(range.startContainer, root);

    this.pendingSelection = { selectedText, contextBefore, contextAfter, headingPath };

    const rect = range.getBoundingClientRect();
    this.selectionButtonTop = rect.top - 40;
    this.selectionButtonLeft = rect.left + rect.width / 2 - 80;
    this.showSelectionButton = true;
  }

  onFeedbackButtonClick(): void {
    if (!this.pendingSelection) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.requestFeedback.emit({
      ...this.pendingSelection,
      rect: { top: rect.top, left: rect.left, bottom: rect.bottom }
    });
    this.showSelectionButton = false;
    this.pendingSelection = null;
    sel.removeAllRanges();
  }

  hideSelectionButton(): void {
    this.showSelectionButton = false;
    this.pendingSelection = null;
  }
```

- [ ] **Step 5: Update template**

Vervang het template van het component met:

```typescript
  template: `
    <div
      #viewer
      class="markdown-viewer"
      [style.fontFamily]="fontFamily"
      [style.fontSize.px]="fontSize"
      (mouseup)="onMouseUp()"
      [innerHTML]="renderedContent">
    </div>
    <button
      *ngIf="showSelectionButton"
      class="selection-button"
      [style.top.px]="selectionButtonTop"
      [style.left.px]="selectionButtonLeft"
      (mousedown)="$event.preventDefault()"
      (click)="onFeedbackButtonClick()">
      💬 Feedback toevoegen
    </button>
  `,
```

- [ ] **Step 6: Voeg styling toe voor selection-button**

In de bestaande `styles: [...]` array, voeg vóór de sluitende `\`` toe:

```css
.selection-button {
  position: fixed;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 999;
  white-space: nowrap;
}
.selection-button:hover {
  background: var(--color-primary-hover);
}
```

- [ ] **Step 7: Build + manual verify**

Run: `npm start`
Expected: open een md bestand in view mode, selecteer tekst. Een floating "💬 Feedback toevoegen" knop verschijnt boven de selectie. Klikken doet (nog) niets zichtbaar, maar geen errors in console.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/markdown-viewer/markdown-viewer.component.ts
git commit -m "feat(feedback): selection detection and floating feedback button"
```

---

## Task 2.6: Integratie popover + service in AppComponent

**Files:**
- Modify: `src/app/app.component.ts`

- [ ] **Step 1: Voeg imports toe**

Bovenaan `app.component.ts`:

```typescript
import { FeedbackPopoverComponent } from './components/feedback-popover/feedback-popover.component';
import { FeedbackService } from './services/feedback.service';
```

Voeg `FeedbackPopoverComponent` toe aan `@Component({ imports: [...] })`.

- [ ] **Step 2: Voeg state toe in class**

In de class body (na bestaande velden):

```typescript
  feedbackPopoverVisible = false;
  feedbackPopoverTop = 0;
  feedbackPopoverLeft = 0;
  feedbackPopoverSnippet = '';
  private pendingFeedback: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
  } | null = null;
```

- [ ] **Step 3: Inject FeedbackService**

Update constructor:

```typescript
  constructor(
    private electronService: ElectronService,
    private settingsService: SettingsService,
    private themeService: ThemeService,
    private feedbackService: FeedbackService
  ) {}
```

- [ ] **Step 4: Roep `setCurrentFile` aan bij file open events**

In de bestaande `fileOpened$.subscribe` handler en in `openFile()`, voeg toe na het zetten van `currentFilePath`:

```typescript
this.feedbackService.setCurrentFile(this.currentFilePath);
```

In `saveFileAs()` na het opnieuw ophalen van currentFilePath:

```typescript
this.feedbackService.setCurrentFile(this.currentFilePath);
```

- [ ] **Step 5: Voeg event handlers toe**

Onderaan de class:

```typescript
  onRequestFeedback(data: {
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    headingPath: string[];
    rect: { top: number; left: number; bottom: number };
  }): void {
    this.pendingFeedback = {
      selectedText: data.selectedText,
      contextBefore: data.contextBefore,
      contextAfter: data.contextAfter,
      headingPath: data.headingPath
    };
    this.feedbackPopoverSnippet = data.selectedText.slice(0, 80);
    this.feedbackPopoverTop = data.rect.bottom + 8;
    this.feedbackPopoverLeft = Math.max(8, data.rect.left);
    this.feedbackPopoverVisible = true;
  }

  onFeedbackSave(feedback: string): void {
    if (!this.pendingFeedback) return;
    this.feedbackService.add({
      selectedText: this.pendingFeedback.selectedText,
      contextBefore: this.pendingFeedback.contextBefore,
      contextAfter: this.pendingFeedback.contextAfter,
      headingPath: this.pendingFeedback.headingPath,
      feedback
    });
    this.feedbackPopoverVisible = false;
    this.pendingFeedback = null;
  }

  onFeedbackCancel(): void {
    this.feedbackPopoverVisible = false;
    this.pendingFeedback = null;
  }
```

- [ ] **Step 6: Update template**

In de template, vervang de `<app-markdown-viewer ...>` regel in view mode met:

```html
<app-markdown-viewer
  [content]="content"
  (requestFeedback)="onRequestFeedback($event)"
  class="full-viewer">
</app-markdown-viewer>
```

En voeg vlak vóór de sluitende `</div>` van `app-container` toe:

```html
<app-feedback-popover
  *ngIf="feedbackPopoverVisible"
  [top]="feedbackPopoverTop"
  [left]="feedbackPopoverLeft"
  [snippet]="feedbackPopoverSnippet"
  (save)="onFeedbackSave($event)"
  (cancel)="onFeedbackCancel()">
</app-feedback-popover>
```

- [ ] **Step 7: Manual verify**

Run: `npm start`
Expected: selecteer tekst → klik "💬 Feedback toevoegen" → popover verschijnt. Type feedback → "Opslaan". Check DevTools localStorage: `feedback:<path>` bevat array met item.

- [ ] **Step 8: Commit**

```bash
git add src/app/app.component.ts
git commit -m "feat(feedback): wire popover and FeedbackService in AppComponent"
```

---

## Task 2.7: Highlight rendering in MarkdownViewerComponent

**Files:**
- Modify: `src/app/components/markdown-viewer/markdown-viewer.component.ts`

- [ ] **Step 1: Subscribe op feedback items en re-apply highlights na render**

In `MarkdownViewerComponent`, voeg toe na de bestaande `settingsService.settings$.subscribe(...)` in de constructor:

```typescript
    this.feedbackService.items$.subscribe(() => {
      queueMicrotask(() => this.applyHighlights());
    });
```

- [ ] **Step 2: Implement `ngAfterViewChecked` voor highlight re-apply na render**

Update class signature:

```typescript
export class MarkdownViewerComponent implements OnChanges, AfterViewChecked {
```

Voeg toe (private flag boven constructor):

```typescript
  private needsHighlightApply = false;
```

In `ngOnChanges`, na de `renderedContent` regel:

```typescript
    if (changes['content']) {
      this.renderedContent = this.markdownService.parse(this.content);
      this.needsHighlightApply = true;
    }
```

Voeg `ngAfterViewChecked` toe:

```typescript
  ngAfterViewChecked(): void {
    if (this.needsHighlightApply) {
      this.needsHighlightApply = false;
      this.applyHighlights();
    }
  }
```

- [ ] **Step 3: Implementeer `applyHighlights`**

Voeg deze method toe onderaan de class:

```typescript
  private applyHighlights(): void {
    if (!this.viewerRef) return;
    const root = this.viewerRef.nativeElement;

    root.querySelectorAll('.feedback-highlight').forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    root.normalize();

    const items = this.feedbackService.getItems();
    const text = root.textContent || '';
    const statusUpdates: { id: string; status: any; shifted: boolean }[] = [];

    for (const item of items) {
      const match = findAnchor(item, text);
      const { status, shifted } = resolveStatus(item, match);
      if (status !== item.status || !!shifted !== !!item.shifted) {
        statusUpdates.push({ id: item.id, status, shifted });
      }
      if (match.matchType !== 'none') {
        this.wrapRange(root, match.startIndex, match.endIndex, item);
      }
    }

    if (statusUpdates.length > 0) {
      for (const upd of statusUpdates) {
        this.feedbackService.update(upd.id, { status: upd.status, shifted: upd.shifted });
      }
    }
  }

  private wrapRange(root: HTMLElement, start: number, end: number, item: FeedbackItem): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let offset = 0;
    let startNode: Text | null = null;
    let startOffsetInNode = 0;
    let endNode: Text | null = null;
    let endOffsetInNode = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const length = node.data.length;
      if (!startNode && offset + length > start) {
        startNode = node;
        startOffsetInNode = start - offset;
      }
      if (!endNode && offset + length >= end) {
        endNode = node;
        endOffsetInNode = end - offset;
        break;
      }
      offset += length;
    }

    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffsetInNode);
      range.setEnd(endNode, endOffsetInNode);
      const span = document.createElement('span');
      span.className = 'feedback-highlight' + (item.status === 'processed' ? ' processed' : '');
      span.setAttribute('data-feedback-id', item.id);
      try {
        range.surroundContents(span);
      } catch {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
    } catch (error) {
      console.warn('Could not wrap highlight for item', item.id, error);
    }
  }

  scrollToFeedback(id: string): void {
    if (!this.viewerRef) return;
    const el = this.viewerRef.nativeElement.querySelector(`[data-feedback-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
  }
```

- [ ] **Step 4: Manual verify**

Run: `npm start`. Open bestand. Maak feedback annotatie via popover. Klik "Opslaan".
Expected: geselecteerde tekst krijgt gele highlight. Inspecteer DOM: `<span class="feedback-highlight" data-feedback-id="...">`.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/markdown-viewer/markdown-viewer.component.ts
git commit -m "feat(feedback): render feedback highlights with anchor matching"
```

---

## Task 2.8: FeedbackSidebarComponent

**Files:**
- Create: `src/app/components/feedback-sidebar/feedback-sidebar.component.ts`

- [ ] **Step 1: Maak component**

Schrijf naar `src/app/components/feedback-sidebar/feedback-sidebar.component.ts`:

```typescript
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedbackService, FeedbackItem } from '../../services/feedback.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-feedback-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="sidebar">
      <header class="sidebar-header">
        <h3>Feedback ({{ (items$ | async)?.length || 0 }})</h3>
        <button class="close-btn" (click)="close.emit()" title="Sluiten">✕</button>
      </header>

      <div class="actions">
        <button class="copy-btn" (click)="onCopy()" [disabled]="!hasOpen((items$ | async) || [])">
          📋 Kopieer alle feedback
        </button>
        <div class="bulk-actions">
          <button (click)="onRemoveProcessed()" [disabled]="!hasStatus((items$ | async) || [], 'processed')">
            Verwijder verwerkte
          </button>
          <button (click)="onRemoveOrphaned()" [disabled]="!hasStatus((items$ | async) || [], 'orphaned')">
            Verwijder verweesde
          </button>
        </div>
      </div>

      <div class="items">
        <div
          *ngFor="let item of items$ | async"
          class="item"
          [class.processed]="item.status === 'processed'"
          [class.orphaned]="item.status === 'orphaned'"
          (click)="onItemClick(item)">

          <div class="item-header">
            <span class="item-path" *ngIf="item.headingPath.length > 0">
              {{ item.headingPath.join(' › ') }}
            </span>
            <span class="item-actions">
              <button
                class="status-btn"
                *ngIf="item.status !== 'processed'"
                (click)="$event.stopPropagation(); markProcessed(item)"
                title="Markeer als verwerkt">✓</button>
              <button
                class="status-btn"
                *ngIf="item.status === 'processed'"
                (click)="$event.stopPropagation(); markOpen(item)"
                title="Markeer als open">↺</button>
              <button
                class="delete-btn"
                (click)="$event.stopPropagation(); remove(item)"
                title="Verwijder">🗑️</button>
            </span>
          </div>

          <div class="item-snippet">"{{ item.selectedText | slice:0:60 }}{{ item.selectedText.length > 60 ? '…' : '' }}"</div>
          <div class="item-feedback">{{ item.feedback }}</div>

          <div class="item-badges">
            <span class="badge shifted" *ngIf="item.shifted && item.status !== 'orphaned'">📍 verschoven</span>
            <span class="badge orphaned" *ngIf="item.status === 'orphaned'">⚠️ niet gevonden</span>
            <span class="badge processed" *ngIf="item.status === 'processed'">✓ verwerkt</span>
          </div>
        </div>

        <div class="empty" *ngIf="((items$ | async) || []).length === 0">
          Geen feedback. Selecteer tekst in de viewer en klik "💬 Feedback toevoegen".
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 360px;
      height: 100%;
      background: var(--color-bg-elevated);
      border-left: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      color: var(--color-text);
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .sidebar-header h3 {
      margin: 0;
      font-size: 16px;
      color: var(--color-heading);
    }
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--color-text);
    }
    .actions {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .copy-btn {
      padding: 8px 12px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .copy-btn:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .copy-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bulk-actions {
      display: flex;
      gap: 8px;
    }
    .bulk-actions button {
      flex: 1;
      padding: 6px 8px;
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .bulk-actions button:hover:not(:disabled) {
      background: var(--color-bg-elevated);
    }
    .bulk-actions button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .items {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .item {
      padding: 10px 12px;
      margin-bottom: 8px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      cursor: pointer;
    }
    .item:hover {
      border-color: var(--color-primary);
    }
    .item.processed {
      opacity: 0.6;
    }
    .item.orphaned {
      border-color: var(--color-toast-border);
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }
    .item-path {
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .item-actions {
      display: flex;
      gap: 4px;
    }
    .item-actions button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
      color: var(--color-text);
    }
    .item-actions button:hover {
      background: var(--color-bg-elevated);
      border-radius: 3px;
    }
    .item-snippet {
      font-size: 12px;
      font-style: italic;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }
    .item-feedback {
      font-size: 14px;
      color: var(--color-text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .item-badges {
      margin-top: 8px;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--color-bg-elevated);
      color: var(--color-text-muted);
    }
    .badge.orphaned {
      background: var(--color-toast-bg);
      color: var(--color-toast-text);
    }
    .badge.shifted {
      background: var(--color-bg-elevated);
    }
    .badge.processed {
      background: var(--color-bg-elevated);
    }
    .empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--color-text-muted);
      font-size: 13px;
    }
  `]
})
export class FeedbackSidebarComponent {
  @Output() close = new EventEmitter<void>();
  @Output() scrollTo = new EventEmitter<string>();

  items$: Observable<FeedbackItem[]>;

  constructor(private feedbackService: FeedbackService) {
    this.items$ = this.feedbackService.items$;
  }

  hasOpen(items: FeedbackItem[]): boolean {
    return items.some(i => i.status === 'open');
  }

  hasStatus(items: FeedbackItem[], status: string): boolean {
    return items.some(i => i.status === status);
  }

  onItemClick(item: FeedbackItem): void {
    if (item.status === 'orphaned') return;
    this.scrollTo.emit(item.id);
  }

  markProcessed(item: FeedbackItem): void {
    this.feedbackService.update(item.id, { status: 'processed' });
  }

  markOpen(item: FeedbackItem): void {
    this.feedbackService.update(item.id, { status: 'open' });
  }

  remove(item: FeedbackItem): void {
    this.feedbackService.remove(item.id);
  }

  onRemoveProcessed(): void {
    this.feedbackService.removeByStatus('processed');
  }

  onRemoveOrphaned(): void {
    this.feedbackService.removeByStatus('orphaned');
  }

  onCopy(): void {
    const items = this.feedbackService.getItems().filter(i => i.status === 'open');
    if (items.length === 0) return;

    const filename = this.getCurrentFilename();
    const lines: string[] = [`# Feedback op \`${filename}\`\n`];
    items.forEach((item, idx) => {
      lines.push(`## Feedback ${idx + 1}`);
      if (item.headingPath.length > 0) {
        lines.push(`**Locatie:** ${item.headingPath.join(' › ')}`);
      }
      lines.push(`**Geselecteerde tekst:**`);
      lines.push(`> ${item.selectedText.replace(/\n/g, '\n> ')}`);
      lines.push('');
      lines.push(`**Feedback:**`);
      lines.push(item.feedback);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(err =>
      console.error('Clipboard write failed:', err)
    );
  }

  private getCurrentFilename(): string {
    return (window as any).__currentFilename || 'document.md';
  }
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/feedback-sidebar/feedback-sidebar.component.ts
git commit -m "feat(feedback): add FeedbackSidebarComponent with copy and bulk actions"
```

---

## Task 2.9: Sidebar toggle in toolbar + integratie in AppComponent

**Files:**
- Modify: `src/app/components/toolbar/toolbar.component.ts`
- Modify: `src/app/app.component.ts`

- [ ] **Step 1: Voeg feedback toggle output toe in toolbar**

In `src/app/components/toolbar/toolbar.component.ts`, voeg in de Outputs sectie toe:

```typescript
  @Input() feedbackSidebarOpen = false;
  @Output() toggleFeedbackSidebar = new EventEmitter<void>();
```

(Voeg `Input` toe aan de bestaande angular core import als het er nog niet bij staat.)

Voeg in de template, naast de theme dropdown, een knop toe:

```html
<button
  class="feedback-toggle-btn"
  (click)="toggleFeedbackSidebar.emit()"
  [class.active]="feedbackSidebarOpen"
  title="Feedback paneel">
  💬
</button>
```

Voeg styling toe in de styles array:

```css
.feedback-toggle-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-text);
}
.feedback-toggle-btn:hover {
  background: var(--color-bg-elevated);
}
.feedback-toggle-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
```

- [ ] **Step 2: Voeg state + imports in AppComponent**

In `src/app/app.component.ts`, voeg toe:

```typescript
import { FeedbackSidebarComponent } from './components/feedback-sidebar/feedback-sidebar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { ViewChild } from '@angular/core';
```

(Voeg `ViewChild` toe aan de bestaande core imports.)

Voeg `FeedbackSidebarComponent` toe aan `imports: [...]`.

In de class:

```typescript
  feedbackSidebarOpen = false;
  @ViewChild(MarkdownViewerComponent) viewerComponent?: MarkdownViewerComponent;
```

Voeg method toe:

```typescript
  toggleFeedbackSidebar(): void {
    this.feedbackSidebarOpen = !this.feedbackSidebarOpen;
  }

  onFeedbackScrollTo(id: string): void {
    this.viewerComponent?.scrollToFeedback(id);
  }
```

- [ ] **Step 3: Update template**

Wijzig de `<app-toolbar ...>` regel om de nieuwe inputs/outputs door te geven:

```html
<app-toolbar
  [isEditMode]="isEditMode"
  [hasContent]="content.length > 0"
  [feedbackSidebarOpen]="feedbackSidebarOpen"
  (toggleEdit)="toggleEditMode()"
  (save)="saveFile()"
  (saveAs)="saveFileAs()"
  (open)="openFile()"
  (print)="printFile()"
  (toggleFeedbackSidebar)="toggleFeedbackSidebar()">
</app-toolbar>
```

Wijzig de view-mode div om sidebar te plaatsen:

```html
<div *ngIf="!isEditMode" class="view-mode">
  <app-markdown-viewer
    [content]="content"
    (requestFeedback)="onRequestFeedback($event)"
    class="full-viewer">
  </app-markdown-viewer>
  <app-feedback-sidebar
    *ngIf="feedbackSidebarOpen"
    (close)="toggleFeedbackSidebar()"
    (scrollTo)="onFeedbackScrollTo($event)">
  </app-feedback-sidebar>
</div>
```

Update view-mode styling in de styles array:

```css
.view-mode {
  height: 100%;
  display: flex;
}
.full-viewer {
  flex: 1;
}
```

- [ ] **Step 4: Set window filename hint**

In de bestaande `fileOpened$.subscribe` handler en in `openFile()` na het zetten van `currentFilePath`, voeg toe:

```typescript
(window as any).__currentFilename = this.currentFilePath?.split(/[/\\]/).pop() || 'document.md';
```

- [ ] **Step 5: Manual verify**

Run: `npm start`
Expected:
- Toolbar toont 💬 knop. Klikken opent/sluit sidebar.
- Sidebar toont feedback items, klik op item scrollt naar highlight in viewer (+ flash).
- "Kopieer alle feedback" zet markdown geformatteerd op clipboard (test: open Notepad en plak).
- ✓ knop markeert item als verwerkt → highlight wordt grijs/doorgestreept.
- 🗑️ verwijdert item.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/toolbar/toolbar.component.ts src/app/app.component.ts
git commit -m "feat(feedback): integrate sidebar with toolbar toggle and viewer scroll"
```

---

# Fase 3 — Auto-reload

## Task 3.1a: Extract pure change-detection logica

**Files:**
- Create: `src/electron/file-watcher-logic.ts`
- Create: `src/electron/file-watcher-logic.spec.ts`

- [ ] **Step 1: Schrijf falende tests eerst**

Schrijf naar `src/electron/file-watcher-logic.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test, verifieer dat hij faalt**

Run: `npm test -- file-watcher-logic`
Expected: FAIL — `Cannot find module './file-watcher-logic'`.

- [ ] **Step 3: Implementeer pure functie**

Schrijf naar `src/electron/file-watcher-logic.ts`:

```typescript
export interface ChangeDetectionInput {
  now: number;
  ignoreUntil: number;
  currentMtime: number;
  lastKnownMtime: number;
}

export function shouldReportChange(input: ChangeDetectionInput): boolean {
  if (input.now < input.ignoreUntil) return false;
  if (input.currentMtime === input.lastKnownMtime) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, verifieer slagen**

Run: `npm test -- file-watcher-logic`
Expected: 5 tests pass.

- [ ] **Step 5: Update tsconfig.electron.json om logic file mee te nemen**

Lees `tsconfig.electron.json`. Indien de `include` patroon `src/electron/**/*.ts` is, niets te wijzigen. Anders: voeg toe.

Run: `npm run build:electron`
Expected: succesvolle compilatie (de spec wordt niet gecompileerd door tsc — die filtert die niet expliciet uit). Indien `*.spec.ts` per ongeluk wel meekomt in de dist: voeg `"exclude": ["src/**/*.spec.ts"]` toe aan `tsconfig.electron.json`.

- [ ] **Step 6: Commit**

```bash
git add src/electron/file-watcher-logic.ts src/electron/file-watcher-logic.spec.ts tsconfig.electron.json
git commit -m "feat(reload): extract testable change-detection logic"
```

---

## Task 3.1b: File watcher in Electron main

**Files:**
- Modify: `src/electron/main.ts`

- [ ] **Step 1: Voeg watcher state en functies toe**

In `src/electron/main.ts`, voeg na de bestaande `let currentFilePath: string | null = null;` toe:

```typescript
let currentWatcher: fs.FSWatcher | null = null;
let lastKnownMtime: number = 0;
let ignoreNextChangeUntil: number = 0;
let watcherDebounceTimer: NodeJS.Timeout | null = null;
```

- [ ] **Step 2: Voeg helper functies toe**

Plaats vlak boven de `function openFile` declaratie:

```typescript
function stopWatcher(): void {
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }
}

function startWatcher(filePath: string): void {
  stopWatcher();
  try {
    lastKnownMtime = fs.statSync(filePath).mtimeMs;
    currentWatcher = fs.watch(filePath, () => {
      if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
      watcherDebounceTimer = setTimeout(() => handleExternalChange(filePath), 200);
    });
  } catch (error) {
    console.error('Error starting watcher:', error);
  }
}

function handleExternalChange(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    const report = shouldReportChange({
      now: Date.now(),
      ignoreUntil: ignoreNextChangeUntil,
      currentMtime: stat.mtimeMs,
      lastKnownMtime
    });
    if (!report) return;
    lastKnownMtime = stat.mtimeMs;
    const content = fs.readFileSync(filePath, 'utf-8');
    mainWindow?.webContents.send('file-changed-externally', { filePath, content });
  } catch (error) {
    console.error('Error handling external change:', error);
  }
}
```

Voeg de import bovenaan main.ts toe (vlak na bestaande imports):

```typescript
import { shouldReportChange } from './file-watcher-logic';
```

- [ ] **Step 3: Roep watcher aan bij openen en saven**

Update `openFile`:

```typescript
function openFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    mainWindow?.webContents.send('file-opened', { filePath, content });
    mainWindow?.setTitle(`MD Viewer - ${path.basename(filePath)}`);
    startWatcher(filePath);
  } catch (error) {
    console.error('Error opening file:', error);
  }
}
```

Update `saveFile`:

```typescript
function saveFile(filePath: string, content: string): boolean {
  try {
    ignoreNextChangeUntil = Date.now() + 500;
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    lastKnownMtime = fs.statSync(filePath).mtimeMs;
    mainWindow?.setTitle(`MD Viewer - ${path.basename(filePath)}`);
    if (!currentWatcher) startWatcher(filePath);
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
}
```

Update `open-file-dialog` handler om watcher ook hier te starten — na `currentFilePath = filePath;` toevoegen:

```typescript
    startWatcher(filePath);
```

Update `save-file-as` handler analoog (de bestaande `saveFile` call doet dit al via `startWatcher` als er nog geen watcher is, maar voor zekerheid: na succesvolle save → niets extra nodig, `saveFile` regelt het).

- [ ] **Step 4: Stop watcher bij app afsluiten**

Voeg toe vlak na `mainWindow.on('closed', ...)`:

```typescript
  mainWindow.on('closed', () => {
    stopWatcher();
    mainWindow = null;
  });
```

Vervang de bestaande regel.

- [ ] **Step 5: Build check**

Run: `npm run build:electron`
Expected: succesvolle compilatie.

- [ ] **Step 6: Commit**

```bash
git add src/electron/main.ts
git commit -m "feat(reload): file watcher with debounce and ignore-own-save flag"
```

---

## Task 3.2: Preload + ElectronService observable

**Files:**
- Modify: `src/electron/preload.ts`
- Modify: `src/app/services/electron.service.ts`

- [ ] **Step 1: Update preload**

In `src/electron/preload.ts`, voeg in de `exposeInMainWorld` config toe (na `onMenuPrint`):

```typescript
  onFileChangedExternally: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on('file-changed-externally', (_event, data) => callback(data));
  },
```

Voeg aan de type declaratie onderaan (`interface Window { electronAPI: { ... } }`) toe:

```typescript
      onFileChangedExternally: (callback: (data: { filePath: string; content: string }) => void) => void;
```

- [ ] **Step 2: Update ElectronService**

In `src/app/services/electron.service.ts`, voeg een nieuwe Subject + observable toe (boven de bestaande Subjects):

```typescript
  private fileChangedExternally = new Subject<{ filePath: string; content: string }>();
  fileChangedExternally$ = this.fileChangedExternally.asObservable();
```

In `initListeners()`, voeg toe binnen de `if (this.isElectron())` block:

```typescript
      window.electronAPI.onFileChangedExternally((data) => {
        this.ngZone.run(() => this.fileChangedExternally.next(data));
      });
```

- [ ] **Step 3: Build check**

Run: `npm run build:electron && npm run build:angular`
Expected: beide builds slagen.

- [ ] **Step 4: Commit**

```bash
git add src/electron/preload.ts src/app/services/electron.service.ts
git commit -m "feat(reload): wire file-changed-externally IPC and observable"
```

---

## Task 3.3: ReloadToastComponent

**Files:**
- Create: `src/app/components/reload-toast/reload-toast.component.ts`

- [ ] **Step 1: Maak component**

Schrijf naar `src/app/components/reload-toast/reload-toast.component.ts`:

```typescript
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reload-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast">
      <div class="toast-message">
        <span class="toast-icon">↻</span>
        Dit bestand is gewijzigd op schijf.
      </div>
      <div class="toast-actions">
        <button class="btn-primary" (click)="reload.emit()">Vernieuwen</button>
        <button class="btn-secondary" (click)="ignore.emit()">Negeren</button>
      </div>
    </div>
  `,
  styles: [`
    .toast {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--color-toast-bg);
      color: var(--color-toast-text);
      border: 1px solid var(--color-toast-border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 2000;
    }
    .toast-message {
      font-size: 14px;
    }
    .toast-icon {
      margin-right: 6px;
      font-weight: bold;
    }
    .toast-actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      border: 1px solid var(--color-toast-border);
    }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-primary:hover {
      background: var(--color-primary-hover);
    }
    .btn-secondary {
      background: transparent;
      color: var(--color-toast-text);
    }
    .btn-secondary:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  `]
})
export class ReloadToastComponent {
  @Output() reload = new EventEmitter<void>();
  @Output() ignore = new EventEmitter<void>();
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/reload-toast/reload-toast.component.ts
git commit -m "feat(reload): add ReloadToastComponent"
```

---

## Task 3.4: ReloadConflictModalComponent

**Files:**
- Create: `src/app/components/reload-conflict-modal/reload-conflict-modal.component.ts`

- [ ] **Step 1: Maak component**

Schrijf naar `src/app/components/reload-conflict-modal/reload-conflict-modal.component.ts`:

```typescript
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reload-conflict-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="keepMine.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>Bestand op schijf gewijzigd</h2>
        <p>
          Je hebt onopgeslagen wijzigingen. Het bestand op schijf is gewijzigd
          door een ander proces.
        </p>
        <p>Wat wil je doen?</p>
        <div class="modal-actions">
          <button class="btn-danger" (click)="loadFromDisk.emit()">
            Bestand op schijf laden (mijn wijzigingen weg)
          </button>
          <button class="btn-primary" (click)="keepMine.emit()">
            Mijn versie behouden
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: var(--color-modal-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
    }
    .modal {
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 24px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    }
    h2 {
      margin: 0 0 12px;
      color: var(--color-heading);
      font-size: 18px;
    }
    p {
      margin: 0 0 12px;
      font-size: 14px;
    }
    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      border: 1px solid var(--color-border);
      text-align: left;
    }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .btn-primary:hover {
      background: var(--color-primary-hover);
    }
    .btn-danger {
      background: var(--color-bg);
      color: var(--color-text);
    }
    .btn-danger:hover {
      background: var(--color-bg-elevated);
    }
  `]
})
export class ReloadConflictModalComponent {
  @Output() loadFromDisk = new EventEmitter<void>();
  @Output() keepMine = new EventEmitter<void>();
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:angular`
Expected: succesvolle build.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/reload-conflict-modal/reload-conflict-modal.component.ts
git commit -m "feat(reload): add ReloadConflictModalComponent"
```

---

## Task 3.5: Integratie van toast/modal in AppComponent

**Files:**
- Modify: `src/app/app.component.ts`

- [ ] **Step 1: Voeg imports toe**

```typescript
import { ReloadToastComponent } from './components/reload-toast/reload-toast.component';
import { ReloadConflictModalComponent } from './components/reload-conflict-modal/reload-conflict-modal.component';
```

Voeg beide toe aan `@Component({ imports: [...] })`.

- [ ] **Step 2: Voeg state toe**

In de class body:

```typescript
  reloadToastVisible = false;
  reloadConflictVisible = false;
  private pendingExternalContent: string | null = null;
```

- [ ] **Step 3: Subscribe op fileChangedExternally$**

In `ngOnInit()`, voeg toe:

```typescript
    this.subscriptions.push(
      this.electronService.fileChangedExternally$.subscribe(data => {
        this.pendingExternalContent = data.content;
        if (this.hasUnsavedChanges && this.isEditMode) {
          this.reloadConflictVisible = true;
        } else {
          this.reloadToastVisible = true;
        }
      })
    );
```

- [ ] **Step 4: Voeg handler methods toe**

Onderaan de class:

```typescript
  onReloadConfirm(): void {
    if (this.pendingExternalContent !== null) {
      this.content = this.pendingExternalContent;
      this.pendingExternalContent = null;
      this.hasUnsavedChanges = false;
    }
    this.reloadToastVisible = false;
  }

  onReloadIgnore(): void {
    this.pendingExternalContent = null;
    this.reloadToastVisible = false;
  }

  onConflictLoadFromDisk(): void {
    if (this.pendingExternalContent !== null) {
      this.content = this.pendingExternalContent;
      this.pendingExternalContent = null;
      this.hasUnsavedChanges = false;
    }
    this.reloadConflictVisible = false;
  }

  onConflictKeepMine(): void {
    this.pendingExternalContent = null;
    this.reloadConflictVisible = false;
  }
```

- [ ] **Step 5: Update template**

Voeg vlak vóór de sluitende `</div>` van `app-container` toe (na de feedback-popover):

```html
<app-reload-toast
  *ngIf="reloadToastVisible"
  (reload)="onReloadConfirm()"
  (ignore)="onReloadIgnore()">
</app-reload-toast>

<app-reload-conflict-modal
  *ngIf="reloadConflictVisible"
  (loadFromDisk)="onConflictLoadFromDisk()"
  (keepMine)="onConflictKeepMine()">
</app-reload-conflict-modal>
```

- [ ] **Step 6: Manual verify**

Run: `npm start`. Open een md bestand. Open hetzelfde bestand in een aparte editor (bv. Notepad), wijzig + save.
Expected:
- Toast verschijnt bovenaan: "Dit bestand is gewijzigd op schijf."
- Klik "Vernieuwen": viewer toont nieuwe content + feedback highlights re-applied via bestaande viewer logica.
- Klik "Negeren": toast verdwijnt, content blijft.

Test conflict case: open bestand, ga naar edit mode, type iets (hasUnsavedChanges=true), wijzig bestand extern.
Expected: modal verschijnt met twee opties. "Bestand op schijf laden" vervangt. "Mijn versie behouden" sluit modal.

Test ignore-own-save: in edit mode → typ → Save (Ctrl+S).
Expected: GEEN toast / modal verschijnt.

- [ ] **Step 7: Commit**

```bash
git add src/app/app.component.ts
git commit -m "feat(reload): integrate toast and conflict modal in AppComponent"
```

---

# Eindcontrole

## Task 4.1: End-to-end acceptatie-check

- [ ] **Step 1: Run alle tests**

Run: `npm test`
Expected: alle tests slagen (heading-path, feedback-anchor, feedback.service, theme.service, file-watcher-logic).

- [ ] **Step 2: Run app + complete walkthrough**

Run: `npm start`

Loop alle acceptatiecriteria uit de spec na:

**Dark mode:**
- [ ] Toolbar 🌓 dropdown werkt met Auto / Licht / Donker
- [ ] Auto volgt systeem (test door OS theme te wisselen, app reageert binnen 1s)
- [ ] Alle UI elementen (viewer, editor, toolbar, welcome, sidebar, toasts, modals) volgen thema
- [ ] Code blocks krijgen passend thema
- [ ] Theme keuze blijft bewaard na herstart

**Feedback:**
- [ ] Selectie in view mode → floating knop verschijnt
- [ ] Popover voor invoer werkt + ESC annuleert + Ctrl/Cmd+Enter saved
- [ ] Highlight verschijnt na opslaan
- [ ] Sidebar toggle in toolbar werkt
- [ ] Klik op sidebar item → scrollIntoView + flash op highlight
- [ ] Heading-pad wordt correct getoond (bv. `Intro › Setup`)
- [ ] "Kopieer alle feedback" produceert correcte markdown (test plak in Notepad)
- [ ] ✓ knop markeert als verwerkt → highlight grijs/doorgestreept
- [ ] 🗑️ verwijdert item + highlight
- [ ] "Verwijder verwerkte" werkt bulk
- [ ] Sluit + heropen bestand → feedback komt terug
- [ ] Wijzig bestand licht (extern) en herlaad → highlights blijven (exact of fuzzy)
- [ ] Verwijder geanker tekst uit bestand → item krijgt orphaned badge

**Auto-reload:**
- [ ] Extern wijzigen → toast
- [ ] Vernieuwen werkt
- [ ] Negeren werkt
- [ ] Save vanuit app triggert geen toast
- [ ] Edit mode + unsaved + externe wijziging → conflict modal
- [ ] "Bestand op schijf laden" werkt
- [ ] "Mijn versie behouden" werkt
- [ ] Sluit en heropen ander bestand → watcher switcht correct

- [ ] **Step 3: Eventuele bugs in dit task afronden**

Als iets niet werkt: fix in dezelfde task, kleine focused commits.

- [ ] **Step 4: Finale commit (alleen bij eventuele fixes)**

```bash
git add -A
git commit -m "fix: address findings from end-to-end acceptance check"
```

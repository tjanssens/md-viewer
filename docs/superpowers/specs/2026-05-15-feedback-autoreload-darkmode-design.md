# Design: Feedback annotaties, auto-reload en dark mode

**Datum:** 2026-05-15
**Status:** Goedgekeurd door user, gereed voor implementatie planning

## Doel

Drie onafhankelijke verbeteringen aan de bestaande Markdown viewer (Angular 17 + Electron):

1. **Feedback annotaties** — gebruiker kan tekst selecteren in view mode, annotatie toevoegen, lijst bekijken, en alle feedback in markdown-formaat naar clipboard kopiëren voor verwerking door Claude.
2. **Auto-reload** — bij externe wijziging van het geopende bestand vraagt de viewer of het herladen moet worden.
3. **Dark mode** — auto (systeem) / light / dark theme keuze.

## Implementatievolgorde

1. Dark mode (raakt veel CSS — eerst doen voorkomt rework op andere features)
2. Feedback annotaties
3. Auto-reload

---

## Feature 1 — Feedback annotaties

### Gebruikersflow

1. Gebruiker is in **view mode** (niet edit mode — daar bewerk je toch direct).
2. Gebruiker selecteert tekst in de viewer.
3. Floating button "💬 Feedback toevoegen" verschijnt boven de selectie (Medium/Notion stijl).
4. Klik opent een popover met textarea + "Opslaan" / "Annuleren".
5. Na opslaan krijgt de selectie een gele highlight (`<span class="feedback-highlight" data-feedback-id="...">`).
6. Rechts opent een toggle-bare sidebar met alle feedback items voor het huidige bestand:
   - Snippet (eerste 60 chars van geselecteerde tekst)
   - Feedback tekst
   - Heading-pad (bv. `Introductie › Installatie › Vereisten`)
   - Status badge (open / processed / orphaned)
   - Acties: ✓ markeer als verwerkt, 🗑️ verwijder
7. Klik op een item in de sidebar → `scrollIntoView` op de bijbehorende highlight + korte flash animatie.
8. Knop **"Kopieer alle feedback"** bovenaan de sidebar → markdown geformatteerd naar clipboard.
9. Knop **"Verwijder verwerkte"** → bulk delete van items met status `processed`.
10. Knop **"Verwijder verweesde"** → bulk delete van items met status `orphaned`.

### Data model

```typescript
interface FeedbackItem {
  id: string;                    // uuid
  selectedText: string;          // de geselecteerde tekst
  contextBefore: string;         // 50 chars vóór selectie (uit gerenderde tekst)
  contextAfter: string;          // 50 chars ná selectie
  headingPath: string[];         // ['Introductie', 'Installatie', 'Vereisten']
  feedback: string;              // user input
  status: 'open' | 'processed' | 'orphaned';
  createdAt: string;             // ISO timestamp
}
```

### Heading-pad bepalen

Bij maken van annotatie: vanaf het anchor-element van de selectie omhoog door de DOM lopen, en voor elke voorgaande heading (H1–H6) de tekst noteren met respect voor hiërarchie. Resultaat: een array van strings van hoog → laag niveau.

Algoritme:
- Begin bij het selectie-element.
- Loop alle voorgaande siblings + ouders' voorgaande siblings.
- Bij elke heading: noteer level + tekst.
- Bouw pad zo dat alleen heading levels lager dan al gevonden levels bewaard blijven (van diepste naar ondieper).
- Keer pad om voor weergave.

### Anker strategie (rerender én reload)

Bij elke render of reload van content:

1. **Exacte match**: zoek `contextBefore + selectedText + contextAfter` in de gerenderde tekst → wrap met highlight span. Status blijft.
2. **Fuzzy match**: alleen `selectedText` gevonden, maar context wijkt af → wrap eerste voorkomen met highlight span + sidebar item krijgt badge "📍 verschoven". Status blijft `open` of `processed`.
3. **Geen match**: `selectedText` niet meer aanwezig → status wordt `orphaned`, geen highlight, sidebar item krijgt badge "⚠️ niet gevonden in document".

### Opslag

`localStorage`, sleutel `feedback:<filePath>`. Per bestand een aparte set. Bij open van een ander bestand: laad de set voor dat path. Bij externe reload: behoud bestaande feedback en pas anker strategie toe op nieuwe content.

### Clipboard format

```markdown
# Feedback op `<filename>`

## Feedback 1
**Locatie:** Introductie › Installatie › Vereisten
**Geselecteerde tekst:**
> <selectedText>

**Feedback:**
<feedback>

---

## Feedback 2
...
```

Alleen items met status `open` worden meegekopieerd (verwerkt en verweesd niet).

### Componenten

- `FeedbackService` — CRUD op feedback items, persistence in localStorage, observable per filePath.
- `FeedbackPopoverComponent` — floating popover voor invoer.
- `FeedbackSidebarComponent` — lijst met items, acties, kopie-knop.
- Aanpassing `MarkdownViewerComponent` — selectie detectie, highlight rendering, scroll-to-item.
- Aanpassing `AppComponent` — sidebar toggle, integratie met file open events.

---

## Feature 2 — Auto-reload bij externe wijziging

### Detectie (Electron main process)

- Bij `openFile(filePath)`: start `fs.watch(filePath, ...)` met 200ms debounce (Windows fs.watch firet vaak dubbel).
- Bij `closeFile()` of openen van een ander bestand: stop de actieve watcher.
- Bij eigen save (`saveFile`): zet `ignoreNextChangeUntil = Date.now() + 500` zodat de eigen schrijfactie niet als externe wijziging wordt gezien. Backup-check: vergelijk mtime tegen laatst bekende mtime.
- Bij externe wijziging: lees nieuwe content, stuur IPC `file-changed-externally` met `{ filePath, content }`.

### UI (renderer)

- Toast bovenaan de viewer: "Dit bestand is gewijzigd op schijf. [Vernieuwen] [Negeren]"
- Bij **Vernieuwen**:
  - Vervang `content`
  - Trigger feedback re-anchoring (Feature 1 logica)
- Bij **Negeren**: toast verdwijnt, geen actie.
- Edge case: unsaved changes in edit mode → modal:
  > "Je hebt onopgeslagen wijzigingen. Het bestand op schijf is gewijzigd door een ander proces."
  > [Bestand op schijf laden (mijn wijzigingen weg)] [Mijn versie behouden]

### Componenten

- Aanpassing `electron/main.ts` — file watcher per geopend bestand, debounce, ignore-eigen-save vlag.
- Aanpassing `electron/preload.ts` — `onFileChangedExternally` listener.
- Aanpassing `ElectronService` — observable `fileChangedExternally$`.
- Nieuwe `ReloadToastComponent` — toast UI.
- Nieuwe `ReloadConflictModalComponent` — modal voor unsaved-changes case.
- Aanpassing `AppComponent` — handler voor reload events.

---

## Feature 3 — Dark mode

### Settings uitbreiding

```typescript
interface AppSettings {
  // bestaand
  fontFamily: string;
  fontSize: number;
  editorFontFamily: string;
  editorFontSize: number;
  // nieuw
  theme: 'auto' | 'light' | 'dark';  // default: 'auto'
}
```

### ThemeService

- Luistert naar settings `theme` veld én naar `matchMedia('(prefers-color-scheme: dark)')`.
- Pusht effectief thema (`'light' | 'dark'`) als observable.
- Wanneer `theme === 'auto'`: volg `matchMedia`. Anders: gebruik gekozen waarde.

### Toepassing

- Class `theme-dark` of `theme-light` op `<body>` (door service in `AppComponent.ngOnInit`).
- CSS variables in `styles.css` voor: backgrounds, text, borders, code blocks, scrollbars.
- Component styles refactoren om CSS variables te gebruiken (viewer, editor, toolbar, welcome screen, split-pane, sidebar, toasts, modals).
- Highlight.js: laad twee thema's (github-light + github-dark), wissel via `<link>` of via class.

### UI control

Kleine icon-toggle in de toolbar (🌓) met dropdown: Auto / Licht / Donker. Wijziging → `SettingsService.updateSettings({ theme })`.

### Componenten

- Nieuwe `ThemeService`.
- Aanpassing `SettingsService` — `theme` veld + getter/setter.
- Aanpassing `ToolbarComponent` — theme dropdown.
- Aanpassing `AppComponent` — body class toggle via ThemeService.
- Refactor van CSS in alle componenten naar CSS variables.

---

## Architectuur overzicht

### Nieuwe services

- `FeedbackService` (singleton, providedIn root)
- `ThemeService` (singleton, providedIn root)

### Nieuwe componenten

- `feedback-popover`
- `feedback-sidebar`
- `reload-toast`
- `reload-conflict-modal`

### Aangepaste bestanden

- `electron/main.ts` — file watcher, IPC voor externe wijziging
- `electron/preload.ts` — extra listener
- `services/electron.service.ts` — `fileChangedExternally$` observable
- `services/settings.service.ts` — theme veld
- `components/markdown-viewer/markdown-viewer.component.ts` — selectie + highlights
- `components/toolbar/toolbar.component.ts` — theme dropdown, feedback sidebar toggle
- `app.component.ts` — integratie van sidebar, toast, modal, theme
- `styles.css` — CSS variables voor light/dark

### IPC kanalen

- Bestaand: `file-opened`, `open-file-dialog`, `save-file`, etc.
- Nieuw: `file-changed-externally` (main → renderer)

---

## Acceptatiecriteria per feature

### Feedback
- [ ] Selectie in view mode toont floating "Feedback toevoegen" knop.
- [ ] Popover slaat feedback op met highlight, heading-pad, en context.
- [ ] Sidebar toggelt en toont alle feedback items voor huidig bestand.
- [ ] Klik op item scrolt naar highlight in viewer.
- [ ] "Kopieer alle feedback" zet correct geformatteerde markdown op clipboard.
- [ ] Bij content change: items worden opnieuw geankerd (exact / fuzzy / orphaned).
- [ ] Bulk-delete knoppen werken voor processed en orphaned items.
- [ ] Feedback wordt per filePath in localStorage bewaard en herladen bij heropen.

### Auto-reload
- [ ] Externe wijziging van het geopende bestand triggert toast.
- [ ] "Vernieuwen" laadt nieuwe content en re-ankert feedback.
- [ ] "Negeren" sluit toast zonder actie.
- [ ] Eigen save triggert geen reload-toast.
- [ ] Unsaved changes + externe wijziging toont conflict-modal.
- [ ] Watcher stopt correct bij sluiten/wisselen van bestand.

### Dark mode
- [ ] Toolbar toont theme dropdown (Auto / Licht / Donker).
- [ ] Auto volgt systeemvoorkeur en past zich aan bij wijziging.
- [ ] Alle UI (viewer, editor, toolbar, welcome, sidebar, toasts, modals) volgt het thema.
- [ ] Code blocks (highlight.js) wisselen mee met thema.
- [ ] Theme keuze wordt bewaard in localStorage en hersteld bij herstart.

# MD Viewer

A modern Markdown viewer and editor for Windows and macOS.

## Download

**[Download Latest Release](https://github.com/tjanssens/md-viewer/releases/latest)**

| Platform | Download |
|----------|----------|
| Windows | [MD Viewer Setup 1.0.0.exe](https://github.com/tjanssens/md-viewer/releases/download/v1.0.0/MD.Viewer.Setup.1.0.0.exe) |
| macOS | [MD Viewer-1.0.0-arm64.dmg](https://github.com/tjanssens/md-viewer/releases/download/v1.0.0/MD.Viewer-1.0.0-arm64.dmg) |

## Features

- **View Mode**: Beautiful rendering of Markdown files with syntax highlighting
- **Edit Mode**: Split-pane editor with live preview and synchronized scrolling
- **Font Selection**: Choose your preferred font and size for reading
- **Dark Mode**: Auto (volgt systeem) / Licht / Donker via 🌓 in de toolbar — alle UI inclusief code-highlighting volgt het thema
- **Feedback annotaties**: Selecteer tekst in view mode → "💬 Feedback toevoegen" → invulveld. Open de sidebar (💬 in toolbar) voor het overzicht. Klik op een item om naar de locatie in het document te springen. "Kopieer alle feedback" zet een Claude-vriendelijk markdown-blok op het clipboard (met heading-pad als locatie-anker). Items overleven kleine wijzigingen aan het document via exact/fuzzy anker-matching; items waarvan de tekst verdwenen is krijgen een "verweesd" badge. Mark-as-processed + bulk-verwijder verwerkte/verweesde items.
- **Auto-reload bij externe wijziging**: Wijzigt het bestand op schijf, dan verschijnt een toast met "Vernieuwen / Negeren". In edit mode met onopgeslagen wijzigingen krijg je een conflict-modal die je laat kiezen tussen "Bestand op schijf laden" en "Mijn versie behouden".
- **File Association**: Double-click .md files to open them directly
- **Native Menus**: Full keyboard shortcuts support (Ctrl/Cmd+O, S, E)

## Installation

### Prerequisites

- Node.js 18+
- npm 9+

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build

# Run unit tests
npm test
```

### Building Installers

```bash
# Windows installer (.exe)
npm run dist:win

# macOS installer (.dmg)
npm run dist:mac

# Both platforms
npm run dist:all
```

## Keyboard Shortcuts

| Action | Windows | macOS |
|--------|---------|-------|
| Open File | Ctrl+O | Cmd+O |
| Save | Ctrl+S | Cmd+S |
| Save As | Ctrl+Shift+S | Cmd+Shift+S |
| Toggle Edit Mode | Ctrl+E | Cmd+E |
| Zoom In | Ctrl++ | Cmd++ |
| Zoom Out | Ctrl+- | Cmd+- |

## Project Structure

```
md-viewer/
├── src/
│   ├── electron/          # Electron main process
│   │   ├── main.ts        # App entry, window management
│   │   ├── menu.ts        # Native menu configuration
│   │   └── preload.ts     # IPC bridge to renderer
│   ├── app/               # Angular application
│   │   ├── components/    # UI components
│   │   └── services/      # Business logic
│   └── assets/            # Static assets
├── assets/                # Build assets (icons)
└── package.json
```

## Technologies

- **Electron** - Cross-platform desktop framework
- **Angular 17** - Frontend framework
- **TypeScript** - Type-safe JavaScript
- **Marked** - Markdown parser
- **Highlight.js** - Syntax highlighting
- **electron-builder** - Installer creation

## License

MIT

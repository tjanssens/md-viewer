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
- **Dark Mode**: Auto (follows system) / Light / Dark via 🌓 in the toolbar — the entire UI including syntax highlighting follows the theme
- **Outline panel** (📑): Toggleable left panel listing every H1–H6 heading from the document, indented by level. Click a heading to scroll the viewer to it. A 💬 badge next to a heading shows how many feedback items live somewhere in that section
- **Feedback annotations**: Select text in view mode → "💬 Add feedback" → write your note. Open the sidebar (💬 in toolbar) for the list. Click an item to scroll to its position in the document; click a yellow highlight in the document to jump to the matching sidebar item. The ✏️ button edits an item inline. **Copy all feedback** puts a Claude-friendly markdown block on the clipboard with the heading path as locator. Items survive small document edits via exact / fuzzy anchor matching; items whose text has disappeared get a *not found* badge. Mark items as processed (✓) and bulk-remove processed or orphaned items
- **Auto-reload on external change**: When the open file is modified on disk, a toast appears with **Reload / Dismiss**. In edit mode with unsaved changes you get a conflict modal that lets you choose between **Load file from disk** and **Keep my version**
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

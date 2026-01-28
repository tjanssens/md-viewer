# MD Viewer

A modern Markdown viewer and editor for Windows and macOS.

## Quick Start (Windows)

Just want to use the app? Download and run the installer:

**[Download MD Viewer Setup 1.0.0.exe](downloads/MD%20Viewer%20Setup%201.0.0.exe)**

Or download directly from the `downloads/` folder in this repository.

## Features

- **View Mode**: Beautiful rendering of Markdown files with syntax highlighting
- **Edit Mode**: Split-pane editor with live preview and synchronized scrolling
- **Font Selection**: Choose your preferred font and size for reading
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

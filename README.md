# MD Viewer

A modern Markdown viewer and editor for Windows and macOS.

## Download

**[Download Latest Release](https://github.com/tjanssens/md-viewer/releases/latest)**

| Platform | Download |
| --- | --- |
| Windows | [MD Viewer Setup 1.0.0.exe](https://github.com/tjanssens/md-viewer/releases/download/v1.0.0/MD.Viewer.Setup.1.0.0.exe) |
| macOS | [MD Viewer-1.0.0-arm64.dmg](https://github.com/tjanssens/md-viewer/releases/download/v1.0.0/MD.Viewer-1.0.0-arm64.dmg) |

## Features

- View mode with Markdown rendering and syntax highlighting.
- Edit mode with a split editor and live preview.
- Font selection for reader and editor comfort.
- Theme selection: auto, light, and dark.
- Document outline with heading navigation and feedback counts.
- Feedback annotations with copy, edit, processed, and orphaned states.
- Auto-reload prompts when the open file changes on disk.
- File association support for `.md` and `.markdown` files.
- Native menus and keyboard shortcuts.

## Prerequisites

- Node.js 18+
- npm 9+

## Development

```bash
npm install
npm start
```

`npm start` builds Angular and Electron once, then starts Angular watch mode and the Electron shell.

Useful commands:

```bash
npm test          # Run Jest unit tests
npm run build    # Build Angular and Electron
npm run check    # Run tests, then production build
npm run dist     # Build app installers
```

## Keyboard Shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| Open File | Ctrl+O | Cmd+O |
| Save | Ctrl+S | Cmd+S |
| Save As | Ctrl+Shift+S | Cmd+Shift+S |
| Toggle Edit Mode | Ctrl+E | Cmd+E |
| Zoom In | Ctrl++ | Cmd++ |
| Zoom Out | Ctrl+- | Cmd+- |

## Project Structure

```text
md-viewer/
  src/
    electron/      Electron main process, menu, preload bridge, updater
    app/
      components/  Angular UI components
      services/    Application state, parsing, settings, feedback logic
    styles.css     Theme tokens and global styling
  docs/            Development specs and implementation plans
```

## Quality Notes

- Keep persisted data validation in small pure helpers so it is easy to test.
- Keep Electron IPC behind `ElectronService` and the preload bridge.
- Add focused Jest tests for critical behavior before changing implementation.
- Use `npm run check` before packaging or handing off changes.

## Technologies

- Electron
- Angular 17
- TypeScript
- Marked
- Highlight.js
- electron-builder

## License

MIT

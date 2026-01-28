import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createMenu } from './menu';

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false
  });

  // Load the Angular app
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Check if file was passed as argument (file association)
    const filePath = process.argv.find(arg => arg.endsWith('.md') || arg.endsWith('.markdown'));
    if (filePath && fs.existsSync(filePath)) {
      openFile(filePath);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up menu
  const menu = createMenu(mainWindow);
  Menu.setApplicationMenu(menu);
}

function openFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    mainWindow?.webContents.send('file-opened', { filePath, content });
    mainWindow?.setTitle(`MD Viewer - ${path.basename(filePath)}`);
  } catch (error) {
    console.error('Error opening file:', error);
  }
}

function saveFile(filePath: string, content: string): boolean {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    mainWindow?.setTitle(`MD Viewer - ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    mainWindow?.setTitle(`MD Viewer - ${path.basename(filePath)}`);
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('save-file', async (_event, content: string) => {
  if (currentFilePath) {
    return saveFile(currentFilePath, content);
  }
  return false;
});

ipcMain.handle('save-file-as', async (_event, content: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: currentFilePath || 'untitled.md'
  });

  if (!result.canceled && result.filePath) {
    return saveFile(result.filePath, content);
  }
  return false;
});

ipcMain.handle('get-current-file-path', () => {
  return currentFilePath;
});

ipcMain.handle('get-system-fonts', async () => {
  // Return common fonts that are available on most systems
  const commonFonts = [
    'Arial',
    'Calibri',
    'Cambria',
    'Comic Sans MS',
    'Consolas',
    'Courier New',
    'Georgia',
    'Helvetica',
    'Impact',
    'Lucida Console',
    'Palatino Linotype',
    'Segoe UI',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    // macOS specific
    'San Francisco',
    'Menlo',
    'Monaco',
    'Avenir',
    'Helvetica Neue'
  ];
  return commonFonts;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open on macOS
app.on('open-file', (_event, filePath) => {
  if (mainWindow) {
    openFile(filePath);
  } else {
    app.whenReady().then(() => {
      openFile(filePath);
    });
  }
});

// Export for menu
export { openFile, mainWindow };

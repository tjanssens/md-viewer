import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (content: string) => ipcRenderer.invoke('save-file', content),
  saveFileAs: (content: string) => ipcRenderer.invoke('save-file-as', content),
  getCurrentFilePath: () => ipcRenderer.invoke('get-current-file-path'),

  // System
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),

  // Event listeners
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on('file-opened', (_event, data) => callback(data));
  },

  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu-save', () => callback());
  },

  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.on('menu-save-as', () => callback());
  },

  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on('menu-open', () => callback());
  },

  onMenuToggleEdit: (callback: () => void) => {
    ipcRenderer.on('menu-toggle-edit', () => callback());
  },

  onMenuPrint: (callback: () => void) => {
    ipcRenderer.on('menu-print', () => callback());
  },

  onFileChangedExternally: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on('file-changed-externally', (_event, data) => callback(data));
  },

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  openReleasePage: (url?: string) => ipcRenderer.invoke('updater:open-release', url),
  onUpdateAvailable: (callback: (data: { version: string; releaseUrl: string }) => void) => {
    ipcRenderer.on('update-available', (_event, data) => callback(data));
  },
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<{ filePath: string; content: string } | null>;
      saveFile: (content: string) => Promise<boolean>;
      saveFileAs: (content: string) => Promise<boolean>;
      getCurrentFilePath: () => Promise<string | null>;
      getSystemFonts: () => Promise<string[]>;
      onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      onMenuOpen: (callback: () => void) => void;
      onMenuToggleEdit: (callback: () => void) => void;
      onMenuPrint: (callback: () => void) => void;
      onFileChangedExternally: (callback: (data: { filePath: string; content: string }) => void) => void;
      checkForUpdates: () => Promise<void>;
      quitAndInstall: () => Promise<void>;
      openReleasePage: (url?: string) => Promise<void>;
      onUpdateAvailable: (callback: (data: { version: string; releaseUrl: string }) => void) => void;
      onUpdateDownloaded: (callback: (data: { version: string }) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

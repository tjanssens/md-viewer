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
      removeAllListeners: (channel: string) => void;
    };
  }
}

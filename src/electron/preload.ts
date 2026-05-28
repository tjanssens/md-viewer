import { contextBridge, ipcRenderer } from 'electron';

interface UpdateStatus {
  state: 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
  releaseUrl?: string;
  mode?: 'win' | 'mac';
}

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
  getUpdateLogs: () => ipcRenderer.invoke('updater:get-logs'),
  getAppVersion: () => ipcRenderer.invoke('updater:get-version'),
  onUpdateStatus: (callback: (data: UpdateStatus) => void) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  onUpdateLog: (callback: (line: string) => void) => {
    ipcRenderer.on('update-log', (_event, line) => callback(line));
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
      getUpdateLogs: () => Promise<string[]>;
      getAppVersion: () => Promise<string>;
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void;
      onUpdateLog: (callback: (line: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

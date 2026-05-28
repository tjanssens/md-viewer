// Type definitions for Electron API exposed via preload
export interface ElectronAPI {
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

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
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

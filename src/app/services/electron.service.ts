import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

export interface FileData {
  filePath: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private fileOpened = new Subject<FileData>();
  private menuSave = new Subject<void>();
  private menuSaveAs = new Subject<void>();
  private menuOpen = new Subject<void>();
  private menuToggleEdit = new Subject<void>();

  fileOpened$ = this.fileOpened.asObservable();
  menuSave$ = this.menuSave.asObservable();
  menuSaveAs$ = this.menuSaveAs.asObservable();
  menuOpen$ = this.menuOpen.asObservable();
  menuToggleEdit$ = this.menuToggleEdit.asObservable();

  constructor(private ngZone: NgZone) {
    this.initListeners();
  }

  private initListeners(): void {
    if (this.isElectron()) {
      window.electronAPI.onFileOpened((data) => {
        this.ngZone.run(() => this.fileOpened.next(data));
      });

      window.electronAPI.onMenuSave(() => {
        this.ngZone.run(() => this.menuSave.next());
      });

      window.electronAPI.onMenuSaveAs(() => {
        this.ngZone.run(() => this.menuSaveAs.next());
      });

      window.electronAPI.onMenuOpen(() => {
        this.ngZone.run(() => this.menuOpen.next());
      });

      window.electronAPI.onMenuToggleEdit(() => {
        this.ngZone.run(() => this.menuToggleEdit.next());
      });
    }
  }

  isElectron(): boolean {
    return !!(window && window.electronAPI);
  }

  async openFileDialog(): Promise<FileData | null> {
    if (this.isElectron()) {
      return await window.electronAPI.openFileDialog();
    }
    return null;
  }

  async saveFile(content: string): Promise<boolean> {
    if (this.isElectron()) {
      return await window.electronAPI.saveFile(content);
    }
    return false;
  }

  async saveFileAs(content: string): Promise<boolean> {
    if (this.isElectron()) {
      return await window.electronAPI.saveFileAs(content);
    }
    return false;
  }

  async getCurrentFilePath(): Promise<string | null> {
    if (this.isElectron()) {
      return await window.electronAPI.getCurrentFilePath();
    }
    return null;
  }

  async getSystemFonts(): Promise<string[]> {
    if (this.isElectron()) {
      return await window.electronAPI.getSystemFonts();
    }
    return ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CurrentFileService {
  private filenameSubject = new BehaviorSubject<string>('document.md');
  filename$ = this.filenameSubject.asObservable();

  setCurrentFile(filePath: string | null): void {
    const name = filePath?.split(/[/\\]/).pop() || 'document.md';
    this.filenameSubject.next(name);
  }

  getFilename(): string {
    return this.filenameSubject.value;
  }
}

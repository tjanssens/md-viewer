import { Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { FileData } from './services/electron.service';
import { UpdateStatus } from './electron.d';

describe('AppComponent file state', () => {
  it('updates feedback and current-file services after Save As succeeds', async () => {
    const fileOpened = new Subject<FileData>();
    const fileChangedExternally = new Subject<{ filePath: string; content: string }>();
    const menuSave = new Subject<void>();
    const menuSaveAs = new Subject<void>();
    const menuOpen = new Subject<void>();
    const menuToggleEdit = new Subject<void>();
    const menuPrint = new Subject<void>();
    const updateStatus = new Subject<UpdateStatus>();
    const updateLog = new Subject<string>();

    const electronService = {
      fileOpened$: fileOpened.asObservable(),
      fileChangedExternally$: fileChangedExternally.asObservable(),
      menuSave$: menuSave.asObservable(),
      menuSaveAs$: menuSaveAs.asObservable(),
      menuOpen$: menuOpen.asObservable(),
      menuToggleEdit$: menuToggleEdit.asObservable(),
      menuPrint$: menuPrint.asObservable(),
      updateStatus$: updateStatus.asObservable(),
      updateLog$: updateLog.asObservable(),
      saveFileAs: jest.fn().mockResolvedValue(true),
      getCurrentFilePath: jest.fn().mockResolvedValue('C:\\docs\\saved.md'),
      getUpdateLogs: jest.fn().mockResolvedValue([])
    };
    const feedbackService = { setCurrentFile: jest.fn() };
    const currentFileService = { setCurrentFile: jest.fn() };

    const component = new AppComponent(
      electronService as any,
      {} as any,
      {} as any,
      feedbackService as any,
      currentFileService as any
    );
    component.content = '# Saved';

    await component.saveFileAs();

    expect(component.currentFilePath).toBe('C:\\docs\\saved.md');
    expect(component.hasUnsavedChanges).toBe(false);
    expect(feedbackService.setCurrentFile).toHaveBeenCalledWith('C:\\docs\\saved.md');
    expect(currentFileService.setCurrentFile).toHaveBeenCalledWith('C:\\docs\\saved.md');
  });
});

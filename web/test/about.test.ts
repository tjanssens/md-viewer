import { describe, expect, it, vi } from 'vitest';
import { AboutDialog, REPO_URL, aboutText, shortcutLabel } from '../src/about';

describe('about dialog', () => {
  it('builds a copyable summary', () => {
    expect(aboutText('2.0.3', 'Windows')).toBe(`MD Viewer 2.0.3\nPlatform: Windows\n${REPO_URL}`);
  });

  it('shows Cmd shortcuts on macOS only', () => {
    expect(shortcutLabel('Ctrl+= / Ctrl+-', 'macOS')).toBe('⌘= / ⌘-');
    expect(shortcutLabel('Ctrl+O', 'Windows')).toBe('Ctrl+O');
  });

  it('shows the version and wires the buttons', async () => {
    const overlay = document.createElement('div');
    overlay.hidden = true;
    document.body.append(overlay);
    const act = {
      version: async () => '9.9.9',
      openUrl: vi.fn(async () => {}),
      checkUpdates: vi.fn(async () => {}),
      sendFeedback: vi.fn(),
      notify: vi.fn()
    };
    const dlg = new AboutDialog(overlay, act);
    await dlg.show();
    expect(overlay.hidden).toBe(false);
    expect(overlay.textContent).toContain('9.9.9');
    const button = (label: string) => [...overlay.querySelectorAll('button')].find(b => b.textContent === label)!;
    button('GitHub').click();
    expect(act.openUrl).toHaveBeenCalledWith(REPO_URL);
    button('Check for updates').click();
    expect(act.checkUpdates).toHaveBeenCalled();
    expect(overlay.hidden).toBe(true);
    await dlg.show();
    button('Send feedback').click();
    expect(act.sendFeedback).toHaveBeenCalled();
    expect(overlay.hidden).toBe(true);
  });
});

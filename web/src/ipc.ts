import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Block } from './blocks';

export interface Opened {
  path: string;
  name: string;
  blocks: Block[];
}

export interface UpdateStatus {
  state: 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
  releaseUrl?: string;
  mode?: 'win' | 'mac';
}

export const api = {
  init: () => invoke<Opened | null>('init'),
  ready: () => invoke<void>('ready'),
  openDialog: () => invoke<Opened | null>('open_dialog'),
  openPath: (path: string) => invoke<Opened>('open_path', { path }),
  getContent: () => invoke<string>('get_content'),
  render: (text: string, reset: boolean) => invoke<Block[]>('render', { text, reset }),
  rerender: (reset: boolean) => invoke<Block[]>('rerender', { reset }),
  reloadFromDisk: () => invoke<Block[]>('reload_from_disk'),
  discardDiskChange: () => invoke<void>('discard_disk_change'),
  save: (text: string | null) => invoke<boolean>('save', { text }),
  saveAs: (text: string | null) => invoke<{ path: string; name: string } | null>('save_as', { text }),
  highlight: (items: [string, string][]) => invoke<(string | null)[]>('highlight', { items }),
  highlightCss: () => invoke<string>('highlight_css'),
  feedbackLoad: (path: string) => invoke<unknown>('feedback_load', { path }),
  feedbackSave: (path: string, items: unknown) => invoke<void>('feedback_save', { path, items }),
  print: () => invoke<void>('print'),
  openUrl: (url: string) => invoke<void>('open_url', { url }),
  appVersion: () => invoke<string>('app_version'),
  checkUpdates: () => invoke<void>('check_updates'),
  installUpdate: () => invoke<void>('install_update'),
  updateLogs: () => invoke<string[]>('update_logs'),
  on: <T>(event: string, cb: (payload: T) => void) => listen<T>(event, e => cb(e.payload))
};

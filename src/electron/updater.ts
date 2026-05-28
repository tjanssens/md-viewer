import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as https from 'https';

const REPO_OWNER = 'tjanssens';
const REPO_NAME = 'md-viewer';
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

type UpdateState =
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
  releaseUrl?: string;
  mode?: 'win' | 'mac';
}

let mainWindowRef: BrowserWindow | null = null;
let winListenersBound = false;
let checkSilent = true;
const logBuffer: string[] = [];
const LOG_LIMIT = 300;

export function initUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  ipcMain.handle('updater:check', () => checkForUpdates(false));

  ipcMain.handle('updater:quit-and-install', () => {
    try {
      log('User requested restart & install.');
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    } catch (error) {
      log('quitAndInstall failed: ' + String(error));
    }
  });

  ipcMain.handle('updater:open-release', (_event, url?: string) => {
    return shell.openExternal(url || RELEASES_PAGE);
  });

  ipcMain.handle('updater:get-logs', () => logBuffer.slice());
  ipcMain.handle('updater:get-version', () => app.getVersion());

  // Check shortly after launch so it never blocks window startup.
  setTimeout(() => checkForUpdates(true), 4000);
}

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
}

function log(line: string): void {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  // eslint-disable-next-line no-console
  console.log('[updater]', line);
  logBuffer.push(stamped);
  if (logBuffer.length > LOG_LIMIT) logBuffer.shift();
  send('update-log', stamped);
}

// Non-actionable states (checking / up-to-date / error) are only surfaced in the
// UI when the user explicitly triggered the check. They are always logged.
function sendStatus(status: UpdateStatus): void {
  const quiet =
    status.state === 'checking' ||
    status.state === 'not-available' ||
    status.state === 'error';
  if (checkSilent && quiet) return;
  send('update-status', status);
}

export async function checkForUpdates(silent: boolean): Promise<void> {
  checkSilent = silent;
  if (process.platform === 'darwin') {
    await checkMacUpdate();
  } else {
    checkWinUpdate();
  }
}

// electron-updater logger sink → forwarded to the diagnostics panel.
const updaterLogger = {
  info: (m: unknown) => log('info: ' + stringify(m)),
  warn: (m: unknown) => log('warn: ' + stringify(m)),
  error: (m: unknown) => log('error: ' + stringify(m)),
  debug: (_m: unknown) => {}
};

function stringify(m: unknown): string {
  if (m instanceof Error) return m.stack || m.message;
  if (typeof m === 'string') return m;
  try {
    return JSON.stringify(m);
  } catch {
    return String(m);
  }
}

// Windows: full auto-update via electron-updater (downloads in the background,
// then the renderer offers a restart).
function checkWinUpdate(): void {
  sendStatus({ state: 'checking' });
  log(`Checking for updates (Windows). Current version: ${app.getVersion()}`);

  if (!app.isPackaged) {
    log('App is not packaged (dev build) — electron-updater is disabled here.');
    sendStatus({ state: 'not-available', version: app.getVersion(), message: 'Dev build' });
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.logger = updaterLogger;

    if (!winListenersBound) {
      winListenersBound = true;

      autoUpdater.on('checking-for-update', () => {
        log('Contacting GitHub for update metadata (latest.yml)…');
      });
      autoUpdater.on('update-available', (info: { version: string }) => {
        log(`Update available: ${info.version}. Downloading…`);
        sendStatus({ state: 'downloading', version: info.version, percent: 0, mode: 'win' });
      });
      autoUpdater.on('update-not-available', () => {
        log('Server reports no newer version — you are up to date.');
        sendStatus({ state: 'not-available', version: app.getVersion() });
      });
      autoUpdater.on('download-progress', (p: { percent: number }) => {
        sendStatus({ state: 'downloading', percent: Math.round(p.percent), mode: 'win' });
      });
      autoUpdater.on('update-downloaded', (info: { version: string }) => {
        log(`Update ${info.version} downloaded and ready to install.`);
        sendStatus({ state: 'downloaded', version: info.version, mode: 'win' });
      });
      autoUpdater.on('error', (err: Error) => {
        log('ERROR: ' + (err?.stack || err?.message || String(err)));
        sendStatus({ state: 'error', message: String(err?.message || err) });
      });
    }

    autoUpdater.checkForUpdates().catch((err: Error) => {
      log('checkForUpdates() rejected: ' + (err?.stack || String(err)));
      sendStatus({ state: 'error', message: String(err?.message || err) });
    });
  } catch (error) {
    log('Failed to load electron-updater: ' + String(error));
    sendStatus({ state: 'error', message: String(error) });
  }
}

// macOS: notify-only. Builds here are unsigned, so we compare the latest
// GitHub release against the running version and point the user to the download.
async function checkMacUpdate(): Promise<void> {
  sendStatus({ state: 'checking' });
  log(`Checking for updates (macOS via GitHub API). Current version: ${app.getVersion()}`);
  try {
    const release = await fetchLatestRelease();
    const latest = String(release?.tag_name || '').replace(/^v/, '');
    const current = app.getVersion();
    log(`Latest published release: ${latest || '(none)'}`);
    if (latest && isNewer(latest, current)) {
      log(`Newer version ${latest} available.`);
      sendStatus({
        state: 'available',
        version: latest,
        releaseUrl: release.html_url || RELEASES_PAGE,
        mode: 'mac'
      });
    } else {
      log('You are up to date.');
      sendStatus({ state: 'not-available', version: current });
    }
  } catch (error) {
    log('ERROR: ' + String(error));
    sendStatus({ state: 'error', message: String(error) });
  }
}

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
}

function fetchLatestRelease(): Promise<GithubRelease> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  return getJson(url);
}

function getJson(url: string, redirects = 0): Promise<GithubRelease> {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Too many redirects'));
      return;
    }
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'md-viewer',
            Accept: 'application/vnd.github+json'
          }
        },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            getJson(res.headers.location, redirects + 1).then(resolve, reject);
            return;
          }
          if (status < 200 || status >= 300) {
            res.resume();
            reject(new Error(`GitHub API returned ${status}`));
            return;
          }
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on('error', reject);
  });
}

// Numeric semver comparison. Sufficient for plain MAJOR.MINOR.PATCH tags.
function isNewer(remote: string, current: string): boolean {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const c = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const a = r[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

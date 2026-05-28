import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as https from 'https';

const REPO_OWNER = 'tjanssens';
const REPO_NAME = 'md-viewer';
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

let mainWindowRef: BrowserWindow | null = null;
let winListenersBound = false;

export function initUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  ipcMain.handle('updater:check', () => checkForUpdates(false));

  ipcMain.handle('updater:quit-and-install', () => {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('quitAndInstall failed:', error);
    }
  });

  ipcMain.handle('updater:open-release', (_event, url?: string) => {
    return shell.openExternal(url || RELEASES_PAGE);
  });

  // Check shortly after launch so it never blocks window startup.
  setTimeout(() => checkForUpdates(true), 4000);
}

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
}

export async function checkForUpdates(silent: boolean): Promise<void> {
  if (process.platform === 'darwin') {
    await checkMacUpdate(silent);
  } else {
    checkWinUpdate(silent);
  }
}

// Windows: full auto-update via electron-updater (downloads in the background,
// then the renderer offers a restart).
function checkWinUpdate(silent: boolean): void {
  if (!app.isPackaged) {
    if (!silent) send('update-not-available', { reason: 'dev' });
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;

    if (!winListenersBound) {
      winListenersBound = true;
      autoUpdater.on('update-downloaded', (info: { version: string }) => {
        send('update-downloaded', { version: info.version });
      });
      autoUpdater.on('update-not-available', () => {
        send('update-not-available', {});
      });
      autoUpdater.on('error', (err: Error) => {
        console.error('Updater error:', err);
        send('update-error', { message: String(err?.message || err) });
      });
    }

    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('checkForUpdates failed:', err);
      if (!silent) send('update-error', { message: String(err?.message || err) });
    });
  } catch (error) {
    console.error('electron-updater unavailable:', error);
    if (!silent) send('update-error', { message: String(error) });
  }
}

// macOS: notify-only. Builds here are unsigned, so we compare the latest
// GitHub release against the running version and point the user to the download.
async function checkMacUpdate(silent: boolean): Promise<void> {
  try {
    const release = await fetchLatestRelease();
    const latest = String(release?.tag_name || '').replace(/^v/, '');
    const current = app.getVersion();
    if (latest && isNewer(latest, current)) {
      send('update-available', {
        version: latest,
        releaseUrl: release.html_url || RELEASES_PAGE
      });
    } else if (!silent) {
      send('update-not-available', {});
    }
  } catch (error) {
    console.error('macOS update check failed:', error);
    if (!silent) send('update-error', { message: String(error) });
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

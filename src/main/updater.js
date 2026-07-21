import { app, shell } from 'electron';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { autoUpdater } from 'electron-updater';

const GITHUB_OWNER = 'jose-gallegos-dc';
const GITHUB_REPO = 'pos-print-bridge';
const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

const events = new EventEmitter();
let latestStatus = { state: 'idle' };

function setStatus(status) {
  latestStatus = status;
  events.emit('status', status);
}

/**
 * Self-update (download + install in place) only works where electron-updater
 * can safely overwrite the running binary: the Windows NSIS installer, and a
 * Linux AppImage (a single file the app itself owns). .deb/.rpm installs live
 * under /opt owned by root and are tracked by dpkg/rpm — only the package
 * manager may touch them, so those users get a "new version available" link
 * to the GitHub release instead of an in-place update.
 */
function canSelfUpdate() {
  if (process.platform === 'win32') return true;
  if (process.platform === 'linux') return Boolean(process.env.APPIMAGE);
  return false;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

function checkGithubReleaseManually() {
  setStatus({ state: 'checking' });
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: { 'User-Agent': 'pos-print-bridge' } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const release = JSON.parse(body);
            const latestVersion = String(release.tag_name || '').replace(/^v/, '');
            const currentVersion = app.getVersion();
            if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
              setStatus({ state: 'manual-available', version: latestVersion, url: release.html_url || RELEASES_URL });
            } else {
              setStatus({ state: 'up-to-date' });
            }
          } catch {
            setStatus({ state: 'error', message: 'No se pudo interpretar la respuesta de GitHub.' });
          }
          resolve();
        });
      }
    );
    req.on('error', () => {
      setStatus({ state: 'error', message: 'No se pudo conectar a GitHub.' });
      resolve();
    });
    req.setTimeout(10000, () => req.destroy());
  });
}

function initUpdater() {
  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => setStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => setStatus({ state: 'up-to-date' }));
  autoUpdater.on('download-progress', (progress) =>
    setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }));
}

function checkForUpdates() {
  const check = canSelfUpdate() ? autoUpdater.checkForUpdates() : checkGithubReleaseManually();
  return check.catch((err) => setStatus({ state: 'error', message: err.message }));
}

function downloadUpdate() {
  return autoUpdater.downloadUpdate().catch((err) => setStatus({ state: 'error', message: err.message }));
}

function installUpdate() {
  autoUpdater.quitAndInstall();
}

function openReleasePage(url) {
  shell.openExternal(url || RELEASES_URL);
}

function getUpdateStatus() {
  return latestStatus;
}

function onUpdateStatus(listener) {
  events.on('status', listener);
  return () => events.off('status', listener);
}

export {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  openReleasePage,
  getUpdateStatus,
  onUpdateStatus,
  canSelfUpdate,
};

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

/**
 * Resolves the path that the autostart entry should launch.
 * - AppImage: process.env.APPIMAGE is the outer .AppImage file.
 * - deb/rpm: process.execPath resolves to "<name>.bin", the real Electron
 *   binary that build/afterPack.js renames it to. The original path is a
 *   wrapper script that sets ELECTRON_DISABLE_SANDBOX=1 (chrome-sandbox isn't
 *   installed SUID-root, so launching the .bin directly crashes on startup).
 *   Autostart must go through that wrapper, same as the desktop launcher does.
 */
function resolveLinuxExecPath() {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;

  const execPath = process.execPath;
  if (execPath.endsWith('.bin')) {
    const wrapper = execPath.slice(0, -'.bin'.length);
    if (fs.existsSync(wrapper)) return wrapper;
  }
  return execPath;
}

/**
 * Enables/disables launch-at-login.
 * - Linux: writes/removes an XDG autostart .desktop entry (setLoginItemSettings
 *   is a no-op on Linux in Electron).
 * - Windows: uses app.setLoginItemSettings (registry Run key).
 */
function applyAutostart(enable) {
  if (process.platform === 'linux') {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart');
    const desktopFile = path.join(autostartDir, 'pos-print-bridge.desktop');

    if (enable) {
      fs.mkdirSync(autostartDir, { recursive: true });
      const execPath = resolveLinuxExecPath();
      const execEntry = execPath.includes(' ') ? `"${execPath}"` : execPath;
      const content = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=POS Print Bridge',
        `Exec=${execEntry}`,
        'Terminal=false',
        'Hidden=false',
        'NoDisplay=false',
        'X-GNOME-Autostart-enabled=true',
        'X-KDE-autostart-enabled=true',
      ].join('\n') + '\n';
      fs.writeFileSync(desktopFile, content, 'utf8');
    } else {
      try {
        fs.unlinkSync(desktopFile);
      } catch {
        // File may not exist — safe to ignore
      }
    }
    return;
  }

  // Windows
  try {
    app.setLoginItemSettings({ openAtLogin: enable });
  } catch {
    // Requires a packaged app
  }
}

export { applyAutostart };

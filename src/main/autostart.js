import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

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
      // process.env.APPIMAGE is set by the AppImage runtime and contains the real .AppImage file path
      const execPath = process.env.APPIMAGE || process.execPath;
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

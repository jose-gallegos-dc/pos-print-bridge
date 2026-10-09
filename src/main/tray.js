import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';

function getAssetsPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
}

const APP_TITLE = 'pia · Puente de Impresión Automática';

const STATUS_LABELS = {
  running: 'Ejecutando',
  error: 'Error',
  starting: 'Iniciando...',
};

function createTray(showWindowFn, app) {
  const assetsPath = getAssetsPath();
  const trayIconPath = path.join(assetsPath, 'tray-icon.png');
  const fallbackIconPath = path.join(assetsPath, 'icon.png');

  let icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(fallbackIconPath);
  if (icon.isEmpty()) icon = createFallbackIcon();

  icon = icon.resize({ width: 16, height: 16 });

  const tray = new Tray(icon);
  tray.setToolTip(APP_TITLE);

  // Keep these closed over so updateTrayStatus() can rebuild the context
  // menu later — Tray itself has no way to hand them back to us.
  tray._setStatus = (status) => {
    tray.setToolTip(`${APP_TITLE} - ${STATUS_LABELS[status] || status}`);
    updateTrayMenu(tray, showWindowFn, app, status);
  };
  tray._setStatus('starting');

  // setContextMenu() makes the desktop's tray implementation show the menu
  // on right-click (KDE/Plasma's StatusNotifierItem keeps this separate from
  // the primary click). 'click' handles the primary (left) click to open the
  // window; 'double-click' is kept too since Windows/macOS emit it reliably.
  tray.on('click', () => showWindowFn());
  tray.on('double-click', () => showWindowFn());

  return tray;
}

function updateTrayStatus(tray, status) {
  tray._setStatus(status);
}

function updateTrayMenu(tray, showWindowFn, app, status) {
  const contextMenu = Menu.buildFromTemplate([
    { label: APP_TITLE, enabled: false },
    { type: 'separator' },
    { label: `Estado: ${STATUS_LABELS[status] || status}`, enabled: false },
    { type: 'separator' },
    { label: 'Abrir configuracion', click: () => showWindowFn() },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createFallbackIcon() {
  // Verde caja (#157A4A)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 0x15;
    canvas[i * 4 + 1] = 0x7a;
    canvas[i * 4 + 2] = 0x4a;
    canvas[i * 4 + 3] = 0xff;
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export { createTray, updateTrayStatus };

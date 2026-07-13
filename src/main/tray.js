import { Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';

const STATUS_LABELS = {
  running: 'Ejecutando',
  error: 'Error',
  starting: 'Iniciando...',
};

function createTray(showWindowFn, app) {
  const trayIconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const fallbackIconPath = path.join(__dirname, '../../assets/icon.png');

  let icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(fallbackIconPath);
  if (icon.isEmpty()) icon = createFallbackIcon();

  icon = icon.resize({ width: 16, height: 16 });

  const tray = new Tray(icon);
  tray.setToolTip('POS Print Bridge');

  updateTrayMenu(tray, showWindowFn, app, 'starting');

  tray.on('double-click', () => showWindowFn());

  return tray;
}

function updateTrayStatus(tray, status) {
  tray.setToolTip(`POS Print Bridge - ${STATUS_LABELS[status] || status}`);
}

function updateTrayMenu(tray, showWindowFn, app, status) {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'POS Print Bridge', enabled: false },
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
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 0x1e;
    canvas[i * 4 + 1] = 0x3a;
    canvas[i * 4 + 2] = 0x8a;
    canvas[i * 4 + 3] = 0xff;
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export { createTray, updateTrayStatus };

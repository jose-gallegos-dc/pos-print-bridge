import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import Store from 'electron-store';

import { createServer, stopServer } from './server';
import { createTray, updateTrayStatus } from './tray';
import { applyAutostart } from './autostart';
import {
  printNetwork,
  printUsb,
  printSerial,
  listUsbPrinters,
  listSerialPorts,
  generateTestPage,
  prewarmWinSpooler,
  cleanupWinSpooler,
} from './printer';

const WINDOW_WIDTH = 480;
const WINDOW_HEIGHT = 720;

app.setName('POS Print Bridge');

const store = new Store({
  defaults: {
    serverPort: 5100,
    launchAtStartup: false,
    agentToken: crypto.randomBytes(16).toString('hex'),
  },
});

let mainWindow = null;
let tray = null;

function getAssetsPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
}

function getAppIcon() {
  const assetsPath = getAssetsPath();
  if (process.platform === 'win32') return path.join(assetsPath, 'icon.ico');
  return path.join(assetsPath, 'icon.png');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    icon: getAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of quitting — this is a background agent.
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // The window is hidden (not destroyed) on close, so the renderer keeps its
  // state across reopenings. Notify it so stale test results get cleared.
  mainWindow.on('show', () => {
    mainWindow.webContents.send('window-shown');
  });
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

// Only one instance may bind the HTTP port / claim the USB device at a time.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(() => {
    const dockIconPath = path.join(getAssetsPath(), 'icon.png');
    if (process.platform === 'darwin' && app.dock) {
      const dockIcon = nativeImage.createFromPath(dockIconPath);
      if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
    }

    const port = store.get('serverPort');
    createServer(port, store);
    tray = createTray(showWindow, app);
    updateTrayStatus(tray, 'running');

    // Pre-warm the Windows spooler so the first print is fast (~300ms vs ~3s).
    if (process.platform === 'win32') {
      prewarmWinSpooler();
    }

    applyAutostart(store.get('launchAtStartup'));

    ipcMain.handle('get-config', () => store.store);

    ipcMain.handle('save-config', (_event, config) => {
      if (config.serverPort) store.set('serverPort', config.serverPort);
      if (typeof config.launchAtStartup === 'boolean') {
        store.set('launchAtStartup', config.launchAtStartup);
        applyAutostart(config.launchAtStartup);
      }
      if (config.testPrinterIp) store.set('testPrinterIp', config.testPrinterIp);
      if (config.testPrinterPort) store.set('testPrinterPort', config.testPrinterPort);
      if (config.usbDeviceKey) store.set('usbDeviceKey', config.usbDeviceKey);
      if (config.usbPortPath) store.set('usbPortPath', config.usbPortPath);
      return { success: true };
    });

    ipcMain.handle('regenerate-token', () => {
      const token = crypto.randomBytes(16).toString('hex');
      store.set('agentToken', token);
      return token;
    });

    ipcMain.handle('test-print', async (_event, connectionType) => {
      try {
        const testData = generateTestPage();
        const config = store.store;

        if (connectionType === 'usb') {
          if (!config.usbDeviceKey) {
            return { success: false, error: 'No hay dispositivo USB seleccionado.' };
          }
          await printUsb(config.usbDeviceKey, testData);
          return { success: true, message: 'Pagina de prueba enviada por USB' };
        }

        if (connectionType === 'serial') {
          if (!config.usbPortPath) {
            return { success: false, error: 'No hay puerto serial seleccionado.' };
          }
          await printSerial(config.usbPortPath, testData);
          return { success: true, message: `Pagina de prueba enviada a ${config.usbPortPath}` };
        }

        if (config.testPrinterIp) {
          await printNetwork(config.testPrinterIp, config.testPrinterPort || 9100, testData);
          return { success: true, message: 'Pagina de prueba enviada correctamente' };
        }

        return { success: false, error: 'No hay impresora de prueba configurada. Configura una IP.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('list-usb-printers', () => listUsbPrinters());
    ipcMain.handle('get-serial-ports', () => listSerialPorts());
    ipcMain.handle('get-version', () => app.getVersion());

    // Don't create the window on startup — just the tray icon.
    // User opens the config window from the tray menu.
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopServer();
    if (process.platform === 'win32') {
      cleanupWinSpooler();
    }
  });

  app.on('window-all-closed', () => {
    // Keep running in the tray on all platforms.
  });

  app.on('activate', () => {
    showWindow();
  });
}

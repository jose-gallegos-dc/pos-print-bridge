import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agent', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  regenerateToken: () => ipcRenderer.invoke('regenerate-token'),
  testPrint: (connectionType) => ipcRenderer.invoke('test-print', connectionType),
  listUsbPrinters: () => ipcRenderer.invoke('list-usb-printers'),
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  onWindowShown: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('window-shown', listener);
    return () => ipcRenderer.removeListener('window-shown', listener);
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openReleasePage: (url) => ipcRenderer.invoke('open-release-page', url),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  canSelfUpdate: () => ipcRenderer.invoke('can-self-update'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});

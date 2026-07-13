import express from 'express';
import cors from 'cors';
import { app as electronApp } from 'electron';
import { printNetwork, printUsb, printSerial, listUsbPrinters } from './printer';

const APP_VERSION = electronApp.getVersion();

let server = null;
let lastPrintResult = null;

/**
 * Requires a matching X-Agent-Token header on every request except /health.
 * The agent listens only on 127.0.0.1, but the token stops other local
 * processes/tabs on the same machine from printing without consent.
 */
function requireToken(store) {
  return (req, res, next) => {
    const expected = store.get('agentToken');
    if (!expected) return next();

    const provided = req.get('X-Agent-Token');
    if (provided !== expected) {
      return res.status(401).json({ success: false, error: 'Token invalido o ausente (header X-Agent-Token)' });
    }
    next();
  };
}

function createServer(port, store) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: APP_VERSION });
  });

  app.use(requireToken(store));

  app.get('/status', (_req, res) => {
    res.json({ status: 'ok', version: APP_VERSION, lastPrint: lastPrintResult });
  });

  app.get('/printers/usb', async (_req, res) => {
    res.json(await listUsbPrinters());
  });

  app.post('/print/network', (req, res) => {
    const { ip, port: printerPort, data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Falta el campo "data" (bytes ESC/POS en base64)' });
    }
    if (!ip) {
      return res.status(400).json({ success: false, error: 'Falta el campo "ip" de la impresora' });
    }

    const buffer = Buffer.from(data, 'base64');
    res.json({ success: true, status: 'printing' });

    printNetwork(ip, printerPort || 9100, buffer)
      .then(() => { lastPrintResult = { success: true, at: new Date().toISOString() }; })
      .catch((err) => { lastPrintResult = { success: false, error: err.message, at: new Date().toISOString() }; });
  });

  app.post('/print/usb', (req, res) => {
    const { vendorId, productId, data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Falta el campo "data" (bytes ESC/POS en base64)' });
    }

    const deviceKey = vendorId && productId
      ? `${vendorId.replace(/^0x/, '')}:${productId.replace(/^0x/, '')}`
      : store.get('usbDeviceKey');

    if (!deviceKey) {
      return res.status(400).json({ success: false, error: 'No hay impresora USB configurada. Abre el agente y selecciona una.' });
    }

    const buffer = Buffer.from(data, 'base64');
    res.json({ success: true, status: 'printing' });

    printUsb(deviceKey, buffer)
      .then(() => { lastPrintResult = { success: true, at: new Date().toISOString() }; })
      .catch((err) => { lastPrintResult = { success: false, error: err.message, at: new Date().toISOString() }; });
  });

  app.post('/print/serial', (req, res) => {
    const { path: portPath, data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Falta el campo "data" (bytes ESC/POS en base64)' });
    }

    const targetPath = portPath || store.get('usbPortPath');
    if (!targetPath) {
      return res.status(400).json({ success: false, error: 'No hay puerto serial configurado.' });
    }

    const buffer = Buffer.from(data, 'base64');
    res.json({ success: true, status: 'printing' });

    printSerial(targetPath, buffer)
      .then(() => { lastPrintResult = { success: true, at: new Date().toISOString() }; })
      .catch((err) => { lastPrintResult = { success: false, error: err.message, at: new Date().toISOString() }; });
  });

  server = app.listen(port, '127.0.0.1', () => {
    console.log(`POS Print Bridge escuchando en http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    console.error('Error del servidor:', err.message);
  });

  return server;
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

export { createServer, stopServer };

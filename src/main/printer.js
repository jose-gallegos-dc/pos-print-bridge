import net from 'node:net';

const NETWORK_TIMEOUT = 5000;
const USB_TIMEOUT = 5000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1200;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a transient failure up to RETRY_ATTEMPTS times, ~RETRY_DELAY apart.
 * Covers momentary glitches (printer busy finishing the previous job, brief
 * disconnect) that a single attempt would otherwise report as an outright
 * print failure.
 */
async function withRetry(label, fn) {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`${label}: intento ${attempt}/${RETRY_ATTEMPTS} fallo (${err.message})`);
      if (attempt < RETRY_ATTEMPTS) {
        await delay(RETRY_DELAY);
      }
    }
  }
  throw lastError;
}

// Serializes print jobs per target (usb device / host:port / serial path) so
// two requests in flight at once can never race each other — e.g. the
// Windows USB spooler corrupting its single pending-response slot, two TCP
// sockets hitting the same network printer at once, or two opens racing on
// the same serial port. Each of those looked like a random, unexplained
// failure on one ticket out of many before this queue existed.
const _queues = new Map();

function withQueue(key, fn) {
  const prev = _queues.get(key) || Promise.resolve();
  const job = prev.then(fn, fn);
  _queues.set(key, job.then(() => undefined, () => undefined));
  return job;
}

// Cheap Chinese printers (Xprinter and similar) boot in Chinese character
// mode, where every byte >= 0x80 starts a two-byte GB18030 glyph — so the
// PC850 accents the POS sends (á, é, ñ, ¿...) come out as Chinese characters.
// FS . cancels that mode; printers without it (Epson, etc.) ignore it. It goes
// after a leading ESC @ because on some models the reset re-enables Chinese
// mode; the POS's own ESC t (code page) still follows and applies normally.
const ESC_INIT = Buffer.from([0x1b, 0x40]);
const FS_CANCEL_CHINESE = Buffer.from([0x1c, 0x2e]);

function withChineseModeOff(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.subarray(0, 2).equals(ESC_INIT)) {
    return Buffer.concat([ESC_INIT, FS_CANCEL_CHINESE, buf.subarray(2)]);
  }
  return Buffer.concat([FS_CANCEL_CHINESE, buf]);
}

// ─── Windows Spooler — persistent PowerShell process ─────────────────────────
//
// Spawned once on first print (or pre-warmed on app start).
// Initialization: Add-Type C# compilation → ~3 s (one-time).
// Subsequent prints: write "<printer name>\n<temp file path>\n" to stdin →
// response on stdout → ~300 ms. The target printer is never auto-detected —
// it's whatever setWinTargetPrinter() was last called with (the user's
// explicit choice from the installed-printers list), so a new/renamed
// printer, or an unrelated virtual printer like OneNote, can never be picked
// by accident.
//
let _winProc = null;
let _winRl = null;
let _winInitPromise = null;
let _winPending = null;
let _winTargetPrinterName = null;

/**
 * Sets which Windows-installed printer raw USB print jobs are sent to.
 * Takes effect on the very next print job — no restart of the spooler
 * process needed.
 */
function setWinTargetPrinter(name) {
  _winTargetPrinterName = name || null;
}

const _WIN_PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern bool OpenPrinter(string name, out IntPtr hPrinter, IntPtr defaults);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    public static bool Print(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        var di = new DOCINFO { pDocName = "POS", pDataType = "RAW" };
        if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
        StartPagePrinter(hPrinter);
        IntPtr buf = Marshal.AllocCoTaskMem(data.Length);
        Marshal.Copy(data, 0, buf, data.Length);
        int written;
        bool ok = WritePrinter(hPrinter, buf, data.Length, out written);
        Marshal.FreeCoTaskMem(buf);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return ok;
    }
}
'@

[Console]::Out.WriteLine('INIT_OK')
[Console]::Out.Flush()

while ($true) {
    $printerName = [Console]::In.ReadLine()
    if ($null -eq $printerName -or $printerName -eq 'EXIT') { break }
    $filePath = [Console]::In.ReadLine()
    if ($null -eq $filePath) { break }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ok = [RawPrint]::Print($printerName, $bytes)
        if ($ok) { [Console]::Out.WriteLine('OK') }
        else      { [Console]::Out.WriteLine('ERROR:WritePrinter returned false') }
    } catch {
        [Console]::Out.WriteLine("ERROR:$($_.Exception.Message)")
    }
    [Console]::Out.Flush()
}
`.trim();

/**
 * Resolves once the persistent PowerShell spooler process is ready.
 * Subsequent calls return the same promise (singleton).
 */
function _getWinInitPromise() {
  if (_winInitPromise) return _winInitPromise;

  _winInitPromise = new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const readline = require('readline');

    const encoded = Buffer.from(_WIN_PS_SCRIPT, 'utf16le').toString('base64');

    const ps = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const rl = readline.createInterface({ input: ps.stdout, crlfDelay: Infinity });

    let initialized = false;

    const timer = setTimeout(() => {
      if (!initialized) {
        ps.kill();
        _winInitPromise = null;
        reject(new Error('Tiempo de espera agotado al inicializar el proceso de impresion (15 s)'));
      }
    }, 15000);

    rl.on('line', (rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      if (!initialized) {
        if (line === 'INIT_OK') {
          clearTimeout(timer);
          initialized = true;
          _winProc = ps;
          _winRl = rl;
          resolve();
        }
      } else if (_winPending) {
        const { resolve: res, reject: rej } = _winPending;
        _winPending = null;
        if (line === 'OK') {
          res();
        } else {
          rej(new Error(line.startsWith('ERROR:') ? line.slice(6) : line));
        }
      }
    });

    ps.on('error', (err) => {
      clearTimeout(timer);
      _winInitPromise = null;
      reject(err);
    });

    ps.on('exit', () => {
      _winProc = null;
      _winRl = null;
      _winInitPromise = null;
      if (_winPending) {
        const { reject: rej } = _winPending;
        _winPending = null;
        rej(new Error('El proceso de impresion termino inesperadamente'));
      }
    });
  });

  return _winInitPromise;
}

/**
 * Pre-warm the Windows spooler process so the first real print is fast.
 * Safe to call at app startup even if no printer is installed — errors are silently ignored.
 */
function prewarmWinSpooler() {
  _getWinInitPromise().catch(() => { /* printer may not be configured yet — ignore */ });
}

/**
 * Gracefully shut down the persistent PowerShell process.
 */
function cleanupWinSpooler() {
  if (_winProc) {
    try { _winProc.stdin.write('EXIT\n'); } catch { /* ignore */ }
    setTimeout(() => { try { _winProc.kill(); } catch { /* ignore */ } }, 500);
    _winProc = null;
  }
  _winInitPromise = null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send raw bytes to a network printer via TCP socket.
 */
function printNetwork(host, port, data) {
  return withQueue(`network:${host}:${port}`, () =>
    withRetry('Impresion de red', () => printNetworkOnce(host, port, withChineseModeOff(data))),
  );
}

function printNetworkOnce(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      socket.destroy();
      reject(new Error(`Conexion a ${host}:${port} agoto el tiempo de espera (${NETWORK_TIMEOUT}ms)`));
    }, NETWORK_TIMEOUT);

    socket.connect(port, host, () => {
      socket.write(data, () => {
        if (settled) return;
        clearTimeout(timer);
        socket.end();
        resolve({ success: true });
      });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(`Error de impresora de red: ${err.message}`));
    });

    socket.on('close', () => {
      clearTimeout(timer);
    });
  });
}

// All USB jobs share one queue key regardless of deviceKey: on Windows the
// spooler always targets the printer set via setWinTargetPrinter(), no matter
// what deviceKey is passed, so per-key queuing would still let two Windows
// jobs race each other. On Linux/macOS there's normally one physical USB
// printer configured anyway, so sharing the key costs nothing in practice.
function printUsb(deviceKey, data) {
  return withQueue('usb', () => withRetry('Impresion USB', () => printUsbOnce(deviceKey, withChineseModeOff(data))));
}

/**
 * Send raw bytes to a USB printer.
 * - Windows: uses a persistent PowerShell process with the Windows Spooler API
 *   (libusb bulk transfer is blocked by usbprint.sys on Windows). The target
 *   printer name comes from setWinTargetPrinter() (the user's explicit choice
 *   in Settings) — deviceKey is ignored here on purpose, since a raw USB
 *   vendor/product id can't be reliably mapped back to a Windows print queue.
 * - Linux/macOS: uses libusb bulk transfer directly, addressed by deviceKey
 *   (vendorId:productId).
 */
async function printUsbOnce(deviceKey, data) {
  if (process.platform === 'win32') {
    return await printUsbWindowsPort(data);
  }

  const [vendorStr, productStr] = deviceKey.split(':');
  const vendorId = parseInt(vendorStr, 16);
  const productId = parseInt(productStr, 16);

  if (process.platform === 'linux') {
    const lpNode = findLinuxLpNode(vendorId, productId);
    if (lpNode) return await printLinuxLpNode(lpNode, data);
  }

  const { usb } = require('usb');

  const device = usb.getDeviceList().find((d) => {
    const desc = d.deviceDescriptor;
    return desc.idVendor === vendorId && desc.idProduct === productId;
  });

  if (!device) {
    throw new Error(`Dispositivo USB ${deviceKey} no encontrado. Verifica que este conectado.`);
  }

  try {
    device.open();
  } catch (err) {
    if (/LIBUSB_ERROR_ACCESS/.test(err.message)) {
      throw new Error(
        `Sin permiso para abrir la impresora USB ${deviceKey}. Reinstala el agente (instala la regla udev) y vuelve a conectar la impresora.`,
      );
    }
    throw err;
  }

  let iface = null;
  let detachedKernelDriver = false;
  try {
    iface = findPrinterInterface(device);
    if (!iface) {
      throw new Error('No se encontro interfaz de impresora en el dispositivo USB.');
    }

    if (iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
      detachedKernelDriver = true;
    }

    iface.claim();

    const outEndpoint = iface.endpoints.find(
      (ep) => ep.direction === 'out' && ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK,
    );

    if (!outEndpoint) {
      throw new Error('No se encontro endpoint de salida (bulk OUT) en la impresora.');
    }

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Impresion USB agoto el tiempo de espera (${USB_TIMEOUT}ms)`));
      }, USB_TIMEOUT);

      outEndpoint.transfer(data, (err) => {
        clearTimeout(timer);
        if (err) {
          reject(new Error(`Error de escritura USB: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  } finally {
    // Always release the claimed interface before closing, otherwise the
    // device stays busy and the next print (or another app) cannot claim it.
    if (iface) {
      await new Promise((resolve) => iface.release(true, () => resolve()));
      // Hand the printer back to usblp so /dev/usb/lpN (and CUPS) keep working.
      if (detachedKernelDriver) {
        try { iface.attachKernelDriver(); } catch { /* ignore */ }
      }
    }
    try {
      device.close();
    } catch {
      // Ignore close errors
    }
  }

  return { success: true };
}

/**
 * Windows: send raw ESC/POS bytes via the persistent PowerShell spooler process.
 * Writes data to a temp file, sends "<printer name>\n<temp file path>\n" to the
 * PS process via stdin, and waits for an OK / ERROR response on stdout.
 */
async function printUsbWindowsPort(data) {
  if (!_winTargetPrinterName) {
    throw new Error(
      'No hay impresora de Windows configurada. Abre el agente, ve a la pestana USB y selecciona la impresora instalada.',
    );
  }

  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  await _getWinInitPromise();

  const tmpFile = path.join(os.tmpdir(), `escpos_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(tmpFile, data);

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        _winPending = null;
        reject(new Error('Tiempo de espera agotado al imprimir (10 s)'));
      }, 10000);

      _winPending = {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      };

      _winProc.stdin.write(_winTargetPrinterName + '\n' + tmpFile + '\n');
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  return { success: true };
}

// USB vendor ids of the MCUs that cheap Chinese ESC/POS printers (Xprinter,
// Gprinter, POS-58/80 clones, Rongta, Caysn...) are built on. Most of them
// report the standard Printer class (7) and need nothing special, but some
// firmwares report a vendor-specific class (0xFF) instead — for these vendors
// only, an interface like that with a bulk OUT endpoint is taken as a printer.
const GENERIC_PRINTER_VENDOR_IDS = new Set([
  0x0416, // Winbond / Nuvoton
  0x0483, // STMicroelectronics
  0x0fe6, // ICS Advent
  0x1fc9, // NXP
  0x20d1, // Rongta
  0x28e9, // GigaDevice
  0x4b43, // Caysn
  0x6868, // Zjiang / Gainscha
]);

/**
 * Returns the alt-setting descriptor of the printer interface of a USB
 * device: the Printer class (7), or for known printer-chip vendors a
 * vendor-specific (0xFF) interface with a bulk OUT endpoint.
 */
function findPrinterAltSetting(device) {
  try {
    const configDesc = device.configDescriptor;
    if (!configDesc || !configDesc.interfaces) {
      return null;
    }

    const alts = configDesc.interfaces.flat();
    const printerClass = alts.find((alt) => alt.bInterfaceClass === 7);
    if (printerClass) return printerClass;

    if (!GENERIC_PRINTER_VENDOR_IDS.has(device.deviceDescriptor.idVendor)) return null;
    return alts.find(
      (alt) =>
        alt.bInterfaceClass === 0xff &&
        alt.endpoints.some((ep) => !(ep.bEndpointAddress & 0x80) && (ep.bmAttributes & 0x03) === 0x02),
    ) || null;
  } catch {
    // Device may not be accessible
  }
  return null;
}

/**
 * Find the printer interface in a USB device.
 */
function findPrinterInterface(device) {
  const alt = findPrinterAltSetting(device);
  return alt ? device.interface(alt.bInterfaceNumber) : null;
}

/**
 * Linux: the kernel's usblp driver exposes Printer-class devices as
 * /dev/usb/lpN. Writing there needs no libusb access to the raw device node
 * (which is root-only unless a udev rule grants it) and doesn't steal the
 * printer from usblp/CUPS. Returns the node for vendorId:productId if it
 * exists and is writable by this user, otherwise null.
 */
function findLinuxLpNode(vendorId, productId) {
  const fs = require('fs');
  const path = require('path');
  const base = '/sys/class/usbmisc';

  let names;
  try {
    names = fs.readdirSync(base).filter((name) => /^lp\d+$/.test(name));
  } catch {
    return null;
  }

  for (const name of names) {
    try {
      // .../usbmisc/lpN/device is the USB interface; its parent is the device.
      const usbDevice = path.join(fs.realpathSync(path.join(base, name, 'device')), '..');
      const vid = parseInt(fs.readFileSync(path.join(usbDevice, 'idVendor'), 'utf8'), 16);
      const pid = parseInt(fs.readFileSync(path.join(usbDevice, 'idProduct'), 'utf8'), 16);
      if (vid !== vendorId || pid !== productId) continue;

      const node = `/dev/usb/${name}`;
      fs.accessSync(node, fs.constants.W_OK);
      return node;
    } catch {
      // Not this one, or not writable
    }
  }
  return null;
}

async function printLinuxLpNode(node, data) {
  const fs = require('fs');

  const handle = await fs.promises.open(node, 'w');
  try {
    let timer;
    await Promise.race([
      handle.write(data),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Impresion USB agoto el tiempo de espera (${USB_TIMEOUT}ms)`)),
          USB_TIMEOUT,
        );
      }),
    ]).finally(() => clearTimeout(timer));
  } catch (err) {
    throw new Error(`Error de escritura en ${node}: ${err.message}`);
  } finally {
    handle.close().catch(() => { /* ignore */ });
  }

  return { success: true };
}

/**
 * Windows only: list printers installed in Windows (Get-Printer), so the
 * user can pick the exact target for printUsbWindowsPort() by name instead
 * of the app guessing from the port name — Epson's APD driver names its
 * port "TMUSB001", Star's driver names it differently, and a system printer
 * like OneNote also shows up as a local printer, so no naming pattern is
 * safe to guess from.
 */
function listWindowsPrinters() {
  if (process.platform !== 'win32') return Promise.resolve([]);

  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const ps = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Get-Printer | Select-Object Name,PortName | ConvertTo-Json -Compress',
    ]);

    let out = '';
    ps.stdout.on('data', (chunk) => { out += chunk; });
    ps.on('close', () => {
      try {
        const parsed = JSON.parse(out || '[]');
        const list = Array.isArray(parsed) ? parsed : [parsed];
        resolve(list.filter(Boolean).map((p) => ({ name: p.Name, portName: p.PortName })));
      } catch {
        resolve([]);
      }
    });
    ps.on('error', () => resolve([]));
  });
}

/**
 * List USB devices that have a Printer class interface (class 7).
 */
async function listUsbPrinters() {
  try {
    const { usb } = require('usb');
    const devices = usb.getDeviceList();
    const printers = [];

    for (const device of devices) {
      try {
        const desc = device.deviceDescriptor;
        const configDesc = device.configDescriptor;
        if (!configDesc || !configDesc.interfaces) {
          continue;
        }

        if (findPrinterAltSetting(device)) {
          const deviceKey = desc.idVendor.toString(16).padStart(4, '0') + ':' + desc.idProduct.toString(16).padStart(4, '0');
          let manufacturer = '';
          let product = '';

          try {
            device.open();
            if (desc.iManufacturer) {
              manufacturer = await getStringDescriptorAsync(device, desc.iManufacturer);
            }
            if (desc.iProduct) {
              product = await getStringDescriptorAsync(device, desc.iProduct);
            }
            device.close();
          } catch {
            try { device.close(); } catch { /* ignore */ }
          }

          // Opening the raw device needs udev permissions; sysfs has the
          // same strings and is world-readable.
          if (process.platform === 'linux' && !manufacturer && !product) {
            ({ manufacturer, product } = readLinuxUsbStrings(device));
          }

          printers.push({
            deviceKey,
            vendorId: '0x' + desc.idVendor.toString(16).padStart(4, '0'),
            productId: '0x' + desc.idProduct.toString(16).padStart(4, '0'),
            manufacturer,
            product,
          });
        }
      } catch {
        // Skip inaccessible devices
      }
    }

    return printers;
  } catch {
    return [];
  }
}

function readLinuxUsbStrings(device) {
  const fs = require('fs');
  const sysfsDir = `/sys/bus/usb/devices/${device.busNumber}-${(device.portNumbers || []).join('.')}`;
  const read = (file) => {
    try {
      return fs.readFileSync(`${sysfsDir}/${file}`, 'utf8').trim();
    } catch {
      return '';
    }
  };
  return { manufacturer: read('manufacturer'), product: read('product') };
}

function getStringDescriptorAsync(device, index) {
  return new Promise((resolve) => {
    device.getStringDescriptor(index, (err, value) => {
      resolve(err ? '' : (value || ''));
    });
  });
}

/**
 * List available serial ports, filtered to exclude Bluetooth and debug ports.
 */
async function listSerialPorts() {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();

    const excludePatterns = /bluetooth|debug-console/i;

    return ports
      .filter((p) => !excludePatterns.test(p.path))
      .map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Desconocido',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
      }));
  } catch {
    return [];
  }
}

/**
 * Send raw bytes to a serial port (for RS232 or USB-to-serial printers).
 */
function printSerial(portPath, data) {
  return withQueue(`serial:${portPath}`, () =>
    withRetry('Impresion serial', () => printSerialOnce(portPath, withChineseModeOff(data))),
  );
}

async function printSerialOnce(portPath, data) {
  const { SerialPort } = require('serialport');

  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: portPath,
      baudRate: 9600,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        return reject(new Error(`Error de impresora serial: ${err.message}`));
      }

      port.write(data, (writeErr) => {
        if (writeErr) {
          port.close();
          return reject(new Error(`Error de escritura serial: ${writeErr.message}`));
        }

        port.drain(() => {
          port.close();
          resolve({ success: true });
        });
      });
    });
  });
}

/**
 * Generate a simple ESC/POS test page.
 */
function generateTestPage() {
  const ESC = '\x1B';
  const GS = '\x1D';

  let data = '';

  data += ESC + '@';
  data += ESC + 'a\x01';
  data += GS + '!\x11';
  data += 'pia\n';
  data += GS + '!\x00';
  data += 'Puente de Impresion Automatica\n';
  data += GS + '!\x00';
  data += '--------------------------------\n';
  data += 'Impresion de prueba\n';
  data += 'Test print successful\n';
  data += '--------------------------------\n';
  data += new Date().toLocaleString('es-MX') + '\n';
  data += '\n';
  data += 'La impresora esta configurada\n';
  data += 'correctamente.\n';
  data += '--------------------------------\n';
  data += '\n\n\n';
  data += GS + 'V\x00';

  return Buffer.from(data, 'binary');
}

export {
  printNetwork,
  printUsb,
  printSerial,
  listUsbPrinters,
  listWindowsPrinters,
  listSerialPorts,
  generateTestPage,
  prewarmWinSpooler,
  cleanupWinSpooler,
  setWinTargetPrinter,
};

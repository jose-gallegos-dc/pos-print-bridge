import net from 'node:net';

const NETWORK_TIMEOUT = 5000;
const USB_TIMEOUT = 5000;

// ─── Windows Spooler — persistent PowerShell process ─────────────────────────
//
// Spawned once on first print (or pre-warmed on app start).
// Initialization: Add-Type C# compilation + Get-Printer  → ~3 s (one-time).
// Subsequent prints: write temp file path to stdin → response on stdout → ~300 ms.
//
let _winProc = null;
let _winRl = null;
let _winPrinterName = null;
let _winInitPromise = null;
let _winPending = null;

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

$p = Get-Printer | Where-Object { $_.PortName -like 'USB*' } | Select-Object -First 1
if (-not $p) { $p = Get-Printer | Where-Object { $_.Type -eq 'Local' } | Select-Object -First 1 }
if ($p) {
    $global:printerName = $p.Name
    [Console]::Out.WriteLine("INIT_OK:$($p.Name)")
} else {
    [Console]::Out.WriteLine('INIT_ERROR:No se encontro ninguna impresora local instalada')
}
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line -or $line -eq 'EXIT') { break }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($line)
        $ok = [RawPrint]::Print($global:printerName, $bytes)
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
        if (line.startsWith('INIT_OK:')) {
          clearTimeout(timer);
          initialized = true;
          _winProc = ps;
          _winRl = rl;
          _winPrinterName = line.slice(8);
          resolve();
        } else if (line.startsWith('INIT_ERROR:')) {
          clearTimeout(timer);
          _winInitPromise = null;
          ps.kill();
          reject(new Error(line.slice(11)));
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

/**
 * Send raw bytes to a USB printer.
 * - Windows: uses a persistent PowerShell process with the Windows Spooler API
 *   (libusb bulk transfer is blocked by usbprint.sys on Windows).
 * - Linux/macOS: uses libusb bulk transfer directly.
 */
async function printUsb(deviceKey, data) {
  if (process.platform === 'win32') {
    return await printUsbWindowsPort(data);
  }

  const { usb } = require('usb');

  const [vendorStr, productStr] = deviceKey.split(':');
  const vendorId = parseInt(vendorStr, 16);
  const productId = parseInt(productStr, 16);

  const device = usb.getDeviceList().find((d) => {
    const desc = d.deviceDescriptor;
    return desc.idVendor === vendorId && desc.idProduct === productId;
  });

  if (!device) {
    throw new Error(`Dispositivo USB ${deviceKey} no encontrado. Verifica que este conectado.`);
  }

  device.open();

  let iface = null;
  try {
    iface = findPrinterInterface(device);
    if (!iface) {
      throw new Error('No se encontro interfaz de impresora en el dispositivo USB.');
    }

    if (iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
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
 * Writes data to a temp file, sends the path to the PS process via stdin,
 * and waits for an OK / ERROR response on stdout.
 */
async function printUsbWindowsPort(data) {
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

      _winProc.stdin.write(tmpFile + '\n');
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  return { success: true };
}

/**
 * Find the printer interface (class 7) in a USB device.
 */
function findPrinterInterface(device) {
  try {
    const configDesc = device.configDescriptor;
    if (!configDesc || !configDesc.interfaces) {
      return null;
    }

    for (const ifaceGroup of configDesc.interfaces) {
      for (const alt of ifaceGroup) {
        if (alt.bInterfaceClass === 7) {
          return device.interface(alt.bInterfaceNumber);
        }
      }
    }
  } catch {
    // Device may not be accessible
  }
  return null;
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

        let isPrinter = false;
        for (const ifaceGroup of configDesc.interfaces) {
          for (const alt of ifaceGroup) {
            if (alt.bInterfaceClass === 7) {
              isPrinter = true;
              break;
            }
          }
          if (isPrinter) break;
        }

        if (isPrinter) {
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
async function printSerial(portPath, data) {
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
  data += 'POS Print Bridge\n';
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
  listSerialPorts,
  generateTestPage,
  prewarmWinSpooler,
  cleanupWinSpooler,
};

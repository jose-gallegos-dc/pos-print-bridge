import { useEffect, useState, useCallback } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import InlineMessage from './InlineMessage';
import { useAutoDismissMessage } from '../hooks/useAutoDismissMessage';
import type { UsbPrinterInfo, WindowsPrinterInfo } from '../../../preload';
import { EMPTY_SELECT_SLOT_PROPS, monoFontFamily, monoInputSx } from '../theme';

interface Props {
  deviceKey: string;
  onChange: (deviceKey: string) => void;
  winPrinterName: string;
  onWinPrinterChange: (name: string) => void;
}

const isWindows = window.agent.platform === 'win32';

export default function UsbPrintSection(props: Props) {
  return isWindows ? <WindowsSection {...props} /> : <LibusbSection {...props} />;
}

/**
 * Windows: targets a printer already installed in Windows (Get-Printer),
 * addressed by name. Raw USB vendor/product ids don't map to a Windows
 * print queue, so the app can't offer the libusb-based picker here.
 */
function WindowsSection({ winPrinterName, onWinPrinterChange }: Props) {
  const [printers, setPrinters] = useState<WindowsPrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPrinters(await window.agent.listWindowsPrinters());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () =>
      window.agent.onWindowShown(() => {
        setMessage(null);
        refresh();
      }),
    [refresh],
  );

  // A saved printer that's no longer installed isn't shown as selected: the
  // field falls back to the empty option, which says what was (not) found.
  const selected = printers.some((p) => p.name === winPrinterName) ? winPrinterName : '';

  async function handleTestPrint() {
    if (!selected) {
      setMessage({ type: 'error', text: 'Selecciona la impresora instalada en Windows' });
      return;
    }

    setSending(true);

    try {
      await window.agent.saveConfig({ winPrinterName: selected });
      const result = await window.agent.testPrint('usb');
      setMessage({
        type: result.success ? 'success' : 'error',
        text: (result.success ? result.message : result.error) || '',
      });
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${(err as Error).message}` });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1}>
        <TextField
          select
          size="small"
          fullWidth
          label="Impresora en Windows"
          sx={monoInputSx}
          slotProps={EMPTY_SELECT_SLOT_PROPS}
          value={selected}
          onChange={(e) => onWinPrinterChange(e.target.value)}
        >
          <MenuItem value="">
            {loading
              ? 'Buscando impresoras instaladas...'
              : printers.length === 0
                ? 'No hay impresoras instaladas en Windows'
                : 'Seleccionar impresora...'}
          </MenuItem>
          {printers.map((p) => (
            <MenuItem key={p.name} value={p.name} sx={{ fontFamily: monoFontFamily }}>
              {p.name} [{p.portName}]
            </MenuItem>
          ))}
        </TextField>
        <IconButton onClick={refresh} disabled={loading} title="Refrescar">
          <RefreshIcon />
        </IconButton>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          disabled={sending || !selected}
          onClick={handleTestPrint}
        >
          {sending ? 'Enviando...' : 'Imprimir prueba'}
        </Button>
      </Stack>
      <InlineMessage message={message} />
    </>
  );
}

/**
 * Linux/macOS: talks to the USB device directly via libusb, addressed by
 * vendorId:productId — there's no OS-level print queue in the way.
 */
function LibusbSection({ deviceKey, onChange }: Props) {
  const [printers, setPrinters] = useState<UsbPrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPrinters(await window.agent.listUsbPrinters());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () =>
      window.agent.onWindowShown(() => {
        setMessage(null);
        refresh();
      }),
    [refresh],
  );

  // A saved printer that's no longer connected isn't shown as selected: the
  // field falls back to the empty option, which says what was (not) found.
  const selected = printers.some((p) => p.deviceKey === deviceKey) ? deviceKey : '';

  async function handleTestPrint() {
    if (!selected) {
      setMessage({ type: 'error', text: 'Selecciona una impresora USB' });
      return;
    }

    setSending(true);

    try {
      await window.agent.saveConfig({ usbDeviceKey: selected });
      const result = await window.agent.testPrint('usb');
      setMessage({
        type: result.success ? 'success' : 'error',
        text: (result.success ? result.message : result.error) || '',
      });
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${(err as Error).message}` });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1}>
        <TextField
          select
          size="small"
          fullWidth
          label="Impresora USB"
          sx={monoInputSx}
          slotProps={EMPTY_SELECT_SLOT_PROPS}
          value={selected}
          onChange={(e) => onChange(e.target.value)}
        >
          <MenuItem value="">
            {loading ? 'Buscando dispositivos...' : printers.length === 0 ? 'No se detectaron impresoras USB' : 'Seleccionar impresora...'}
          </MenuItem>
          {printers.map((p) => (
            <MenuItem key={p.deviceKey} value={p.deviceKey} sx={{ fontFamily: monoFontFamily }}>
              {(p.product || p.manufacturer ? `${p.product || 'Impresora'}${p.manufacturer ? ` (${p.manufacturer})` : ''}` : 'Impresora USB')}{' '}
              [{p.deviceKey}]
            </MenuItem>
          ))}
        </TextField>
        <IconButton onClick={refresh} disabled={loading} title="Refrescar">
          <RefreshIcon />
        </IconButton>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          disabled={sending || !selected}
          onClick={handleTestPrint}
        >
          {sending ? 'Enviando...' : 'Imprimir prueba'}
        </Button>
      </Stack>
      <InlineMessage message={message} />
    </>
  );
}

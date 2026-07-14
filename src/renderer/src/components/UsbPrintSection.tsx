import { useEffect, useState, useCallback } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import InlineMessage, { type Message } from './InlineMessage';
import type { UsbPrinterInfo } from '../../../preload';

interface Props {
  deviceKey: string;
  onChange: (deviceKey: string) => void;
}

export default function UsbPrintSection({ deviceKey, onChange }: Props) {
  const [printers, setPrinters] = useState<UsbPrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

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

  async function handleTestPrint() {
    if (!deviceKey) {
      setMessage({ type: 'error', text: 'Selecciona una impresora USB' });
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      await window.agent.saveConfig({ usbDeviceKey: deviceKey });
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
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Prueba de impresion - USB</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            fullWidth
            label="Impresora USB"
            value={deviceKey}
            onChange={(e) => onChange(e.target.value)}
          >
            <MenuItem value="">
              {loading ? 'Buscando dispositivos...' : printers.length === 0 ? 'No se detectaron impresoras USB' : 'Seleccionar impresora...'}
            </MenuItem>
            {printers.map((p) => (
              <MenuItem key={p.deviceKey} value={p.deviceKey}>
                {(p.product || p.manufacturer ? `${p.product || 'Impresora'}${p.manufacturer ? ` (${p.manufacturer})` : ''}` : 'Impresora USB')}{' '}
                [{p.deviceKey}]
              </MenuItem>
            ))}
          </TextField>
          <IconButton onClick={refresh} disabled={loading} title="Refrescar">
            <RefreshIcon />
          </IconButton>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            disabled={sending || !deviceKey}
            onClick={handleTestPrint}
          >
            {sending ? 'Enviando...' : 'Imprimir prueba USB'}
          </Button>
        </Stack>
        <InlineMessage message={message} />
      </AccordionDetails>
    </Accordion>
  );
}

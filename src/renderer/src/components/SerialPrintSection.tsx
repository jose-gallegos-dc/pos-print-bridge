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
import type { SerialPortInfo } from '../../../preload';

interface Props {
  portPath: string;
  onChange: (portPath: string) => void;
}

export default function SerialPrintSection({ portPath, onChange }: Props) {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPorts(await window.agent.getSerialPorts());
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

  async function handleTestPrint() {
    if (!portPath) {
      setMessage({ type: 'error', text: 'Selecciona un puerto serial' });
      return;
    }

    setSending(true);

    try {
      await window.agent.saveConfig({ usbPortPath: portPath });
      const result = await window.agent.testPrint('serial');
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
          label="Puerto serial"
          value={portPath}
          onChange={(e) => onChange(e.target.value)}
        >
          <MenuItem value="">
            {loading ? 'Buscando puertos...' : ports.length === 0 ? 'No se detectaron puertos' : 'Seleccionar puerto...'}
          </MenuItem>
          {ports.map((p) => (
            <MenuItem key={p.path} value={p.path}>
              {p.manufacturer !== 'Desconocido' ? `${p.path} (${p.manufacturer})` : p.path}
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
          disabled={sending || !portPath}
          onClick={handleTestPrint}
        >
          {sending ? 'Enviando...' : 'Imprimir prueba'}
        </Button>
      </Stack>
      <InlineMessage message={message} />
    </>
  );
}

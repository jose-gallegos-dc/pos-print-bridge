import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import PrintIcon from '@mui/icons-material/Print';
import InlineMessage from './InlineMessage';
import { useAutoDismissMessage } from '../hooks/useAutoDismissMessage';
import { monoInputSx } from '../theme';

// Dotted-quad IPv4, each octet 0-255 without leading zeros (e.g. 192.168.1.100).
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isValidPort(port: number) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

interface Props {
  ip: string;
  port: number;
  onChange: (ip: string, port: number) => void;
}

export default function NetworkPrintSection({ ip, port, onChange }: Props) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  const trimmedIp = ip.trim();
  const ipInvalid = trimmedIp !== '' && !IPV4_REGEX.test(trimmedIp);
  const portInvalid = !isValidPort(port);

  useEffect(() => window.agent.onWindowShown(() => setMessage(null)), []);

  async function handleTestPrint() {
    if (!IPV4_REGEX.test(trimmedIp)) {
      setMessage({ type: 'error', text: 'La IP de la impresora no es valida. Usa el formato 192.168.1.100' });
      return;
    }

    if (portInvalid) {
      setMessage({ type: 'error', text: 'El puerto debe ser un numero entre 1 y 65535' });
      return;
    }

    setSending(true);

    try {
      await window.agent.saveConfig({ testPrinterIp: trimmedIp, testPrinterPort: port });
      const result = await window.agent.testPrint('network');
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
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          label="IP de impresora"
          sx={monoInputSx}
          size="small"
          fullWidth
          value={ip}
          placeholder="192.168.1.100"
          error={ipInvalid}
          helperText={ipInvalid ? 'Formato de IP no valido' : undefined}
          onChange={(e) => onChange(e.target.value, port)}
        />
        <TextField
          label="Puerto"
          size="small"
          type="number"
          sx={{ width: 110, ...monoInputSx }}
          value={port}
          error={portInvalid}
          helperText={portInvalid ? '1 a 65535' : undefined}
          onChange={(e) => onChange(ip, Number(e.target.value))}
        />
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          disabled={sending || !ip.trim()}
          onClick={handleTestPrint}
        >
          {sending ? 'Enviando...' : 'Imprimir prueba'}
        </Button>
      </Stack>
      <InlineMessage message={message} />
    </>
  );
}

import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import PrintIcon from '@mui/icons-material/Print';
import InlineMessage from './InlineMessage';
import { useAutoDismissMessage } from '../hooks/useAutoDismissMessage';

interface Props {
  ip: string;
  port: number;
  onChange: (ip: string, port: number) => void;
}

export default function NetworkPrintSection({ ip, port, onChange }: Props) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  useEffect(() => window.agent.onWindowShown(() => setMessage(null)), []);

  async function handleTestPrint() {
    setSending(true);

    try {
      await window.agent.saveConfig({ testPrinterIp: ip, testPrinterPort: port });
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
      <Stack direction="row" spacing={1.5}>
        <TextField
          label="IP de impresora"
          size="small"
          fullWidth
          value={ip}
          placeholder="192.168.1.100"
          onChange={(e) => onChange(e.target.value, port)}
        />
        <TextField
          label="Puerto"
          size="small"
          type="number"
          sx={{ width: 110 }}
          value={port}
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

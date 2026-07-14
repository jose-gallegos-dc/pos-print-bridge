import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrintIcon from '@mui/icons-material/Print';
import InlineMessage, { type Message } from './InlineMessage';

interface Props {
  ip: string;
  port: number;
  onChange: (ip: string, port: number) => void;
}

export default function NetworkPrintSection({ ip, port, onChange }: Props) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function handleTestPrint() {
    setSending(true);
    setMessage(null);

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
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Prueba de impresion - Red</Typography>
      </AccordionSummary>
      <AccordionDetails>
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
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
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
      </AccordionDetails>
    </Accordion>
  );
}

import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface Props {
  port: number;
  launchAtStartup: boolean;
  agentToken: string;
  onPortChange: (port: number) => void;
  onLaunchAtStartupChange: (value: boolean) => void;
  onRegenerateToken: () => void;
}

export default function ConfigSection({
  port,
  launchAtStartup,
  agentToken,
  onPortChange,
  onLaunchAtStartupChange,
  onRegenerateToken,
}: Props) {
  const [showToken, setShowToken] = useState(false);

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Configuración</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Puerto del servidor HTTP"
            size="small"
            type="number"
            value={port}
            helperText="Requiere reiniciar el agente para aplicar"
            onChange={(e) => onPortChange(Number(e.target.value))}
          />

          <TextField
            label="Token del agente (X-Agent-Token)"
            size="small"
            type={showToken ? 'text' : 'password'}
            value={agentToken}
            helperText="El POS debe enviar este valor en el header X-Agent-Token"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={showToken ? 'Ocultar' : 'Mostrar'}>
                    <IconButton size="small" onClick={() => setShowToken((v) => !v)}>
                      {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copiar">
                    <IconButton size="small" onClick={() => navigator.clipboard.writeText(agentToken)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Regenerar token">
                    <IconButton size="small" onClick={onRegenerateToken}>
                      <AutorenewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={launchAtStartup}
                onChange={(e) => onLaunchAtStartupChange(e.target.checked)}
              />
            }
            label="Iniciar con el sistema"
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

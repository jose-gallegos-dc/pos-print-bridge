import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Props {
  port: number;
  launchAtStartup: boolean;
  onPortChange: (port: number) => void;
  onLaunchAtStartupChange: (value: boolean) => void;
}

export default function ConfigSection({
  port,
  launchAtStartup,
  onPortChange,
  onLaunchAtStartupChange,
}: Props) {
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

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import FormHelperText from '@mui/material/FormHelperText';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Props {
  port: number;
  launchAtStartup: boolean;
  onPortChange: (port: number) => void;
  onLaunchAtStartupChange: (value: boolean) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export default function ConfigSection({
  port,
  launchAtStartup,
  onPortChange,
  onLaunchAtStartupChange,
  saving,
  saved,
  onSave,
}: Props) {
  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Configuración</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <TextField
              label="Puerto del servidor HTTP"
              size="small"
              type="number"
              value={port}
              onChange={(e) => onPortChange(Number(e.target.value))}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={launchAtStartup}
                  onChange={(e) => onLaunchAtStartupChange(e.target.checked)}
                />
              }
              label="Autoarranque"
            />
          </Stack>
          <FormHelperText sx={{ mt: -1.5 }}>Aplica al reiniciar</FormHelperText>

          <Button variant="contained" size="large" disabled={saving} onClick={onSave}>
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar configuración'}
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

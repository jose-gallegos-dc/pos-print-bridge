import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import type { UpdateStatus } from '../../../preload';

export default function UpdateSection() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    window.agent.getUpdateStatus().then(setStatus);
    return window.agent.onUpdateStatus(setStatus);
  }, []);

  function handleCheck() {
    window.agent.checkForUpdates();
  }

  function handleDownload() {
    window.agent.downloadUpdate();
  }

  function handleInstall() {
    window.agent.installUpdate();
  }

  function handleOpenPage() {
    if (status.state === 'manual-available') window.agent.openReleasePage(status.url);
  }

  const { label, action } = describeStatus(status, {
    onCheck: handleCheck,
    onDownload: handleDownload,
    onInstall: handleInstall,
    onOpenPage: handleOpenPage,
  });

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      sx={{
        mx: 2,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: 'rgba(30, 58, 138, 0.06)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <SystemUpdateAltIcon fontSize="small" color="action" />
        <Typography variant="body2">{label}</Typography>
      </Stack>
      <Box>{action}</Box>
    </Stack>
  );
}

interface Actions {
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onOpenPage: () => void;
}

function describeStatus(status: UpdateStatus, actions: Actions): { label: string; action: React.ReactNode } {
  switch (status.state) {
    case 'checking':
      return { label: 'Buscando actualizaciones...', action: <CircularProgress size={18} /> };

    case 'available':
      return {
        label: `Version ${status.version} disponible`,
        action: (
          <Button size="small" variant="contained" onClick={actions.onDownload}>
            Descargar
          </Button>
        ),
      };

    case 'manual-available':
      return {
        label: `Version ${status.version} disponible`,
        action: (
          <Button size="small" variant="contained" onClick={actions.onOpenPage}>
            Abrir pagina de descarga
          </Button>
        ),
      };

    case 'downloading':
      return { label: `Descargando actualizacion... ${status.percent}%`, action: <CircularProgress size={18} variant="determinate" value={status.percent} /> };

    case 'ready':
      return {
        label: `Version ${status.version} lista para instalar`,
        action: (
          <Button size="small" variant="contained" color="secondary" onClick={actions.onInstall}>
            Reiniciar y actualizar
          </Button>
        ),
      };

    case 'error':
      return {
        label: status.message,
        action: (
          <Button size="small" onClick={actions.onCheck}>
            Reintentar
          </Button>
        ),
      };

    case 'up-to-date':
      return {
        label: 'Tienes la ultima version',
        action: (
          <Button size="small" onClick={actions.onCheck}>
            Buscar de nuevo
          </Button>
        ),
      };

    default:
      return {
        label: 'Buscar actualizaciones',
        action: (
          <Button size="small" variant="outlined" onClick={actions.onCheck}>
            Buscar
          </Button>
        ),
      };
  }
}

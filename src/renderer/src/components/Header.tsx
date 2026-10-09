import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import iconUrl from '../assets/pia-icono-app.svg';
import { monoFontFamily } from '../theme';

export default function Header({ version }: { version: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, pt: 2, pb: 1 }}>
      <Avatar src={iconUrl} variant="rounded" sx={{ width: 40, height: 40, bgcolor: 'transparent' }} />
      <Stack spacing={0}>
        <Typography variant="h1">pia</Typography>
        <Typography variant="caption" color="text.secondary">
          Puente de Impresión Automática ·{' '}
          <Box component="span" sx={{ fontFamily: monoFontFamily }}>
            v{version}
          </Box>
        </Typography>
      </Stack>
    </Stack>
  );
}

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import iconUrl from '../assets/icon.png';

export default function Header({ version }: { version: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, pt: 2, pb: 1 }}>
      <Avatar src={iconUrl} variant="rounded" sx={{ width: 40, height: 40 }} />
      <Stack spacing={0}>
        <Typography variant="h1">POS Print Bridge</Typography>
        <Typography variant="caption" color="text.secondary">
          v{version}
        </Typography>
      </Stack>
    </Stack>
  );
}

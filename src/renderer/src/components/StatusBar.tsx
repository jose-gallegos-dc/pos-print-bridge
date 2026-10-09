import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { brand, monoFontFamily } from '../theme';

export default function StatusBar({ port }: { port: number }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        mx: 2,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: 'alpha(brand.verdeCaja, 0.08)',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'success.main',
          boxShadow: `0 0 0 3px ${alpha(brand.lima, 0.45)}`,
        }}
      />
      <Typography variant="body2">
        Servidor activo en puerto <Box component="strong" sx={{ fontFamily: monoFontFamily }}>{port}</Box>
      </Typography>
    </Stack>
  );
}

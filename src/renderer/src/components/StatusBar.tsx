import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

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
        bgcolor: 'rgba(30, 58, 138, 0.06)',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'success.main',
          boxShadow: '0 0 0 3px rgba(46, 204, 113, 0.25)',
        }}
      />
      <Typography variant="body2">
        Servidor activo en puerto <strong>{port}</strong>
      </Typography>
    </Stack>
  );
}

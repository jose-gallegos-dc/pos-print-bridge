import { alpha, createTheme } from '@mui/material/styles';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';

// Brand palette (kit de marca pia).
export const brand = {
  verdeCaja: '#157A4A',
  lima: '#B8E62E',
  bosque: '#0F2418',
  papel: '#F7F4EC',
};

// Monospaced like a thermal printer's output: used for the app name,
// ports and printer names.
export const monoFontFamily = '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.verdeCaja,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.lima,
      contrastText: brand.bosque,
    },
    success: {
      main: brand.verdeCaja,
    },
    text: {
      primary: brand.bosque,
      secondary: alpha(brand.bosque, 0.65),
    },
    divider: alpha(brand.bosque, 0.12),
    background: {
      default: brand.papel,
      paper: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: ['Archivo', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'].join(','),
    fontSize: 13,
    h1: { fontFamily: monoFontFamily, fontSize: '1.1rem', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});

// For TextFields whose value is a port, IP or printer name.
export const monoInputSx = { '& .MuiInputBase-input': { fontFamily: monoFontFamily } };

// Selects whose empty option ("No se detectaron...", "Seleccionar...") must
// show in the field itself instead of leaving it blank under the label.
export const EMPTY_SELECT_SLOT_PROPS = {
  select: { displayEmpty: true },
  inputLabel: { shrink: true },
};

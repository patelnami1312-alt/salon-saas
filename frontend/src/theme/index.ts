import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6C3FC5',
      light: '#9B72E8',
      dark: '#4A2A8F',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FF6B6B',
      light: '#FF9898',
      dark: '#C74040',
      contrastText: '#ffffff',
    },
    success: { main: '#4CAF50', light: '#81C784', dark: '#388E3C' },
    warning: { main: '#FF9800', light: '#FFB74D', dark: '#F57C00' },
    error: { main: '#F44336', light: '#EF9A9A', dark: '#C62828' },
    info: { main: '#2196F3', light: '#64B5F6', dark: '#1565C0' },
    background: { default: '#F8F5FF', paper: '#FFFFFF' },
    text: { primary: '#1A1A2E', secondary: '#6B6B8A' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    subtitle1: { fontWeight: 500 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { scrollbarWidth: 'thin', scrollbarColor: '#c8c8c8 transparent' },
        '*::-webkit-scrollbar': { width: 6, height: 6 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': { background: '#c8c8c8', borderRadius: 3 },
        '*::-webkit-scrollbar-thumb:hover': { background: '#9b9b9b' },
        'html': { scrollBehavior: 'smooth' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 12px rgba(108,63,197,0.25)' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6C3FC5, #9B72E8)',
          '&:hover': { background: 'linear-gradient(135deg, #5A33A6, #8B62D8)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 16px rgba(108,63,197,0.08)',
          border: '1px solid rgba(108,63,197,0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
          color: '#ffffff',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#F8F5FF',
            fontWeight: 600,
            color: '#6C3FC5',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#ffffff',
          color: '#1A1A2E',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

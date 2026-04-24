import { createTheme } from '@mui/material/styles';

export const csTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4e9af1' },
    secondary: { main: '#9cdcfe' },
    background: { default: '#1e1e1e', paper: '#252526' },
    text: { primary: '#cccccc', secondary: '#858585' },
    divider: '#454545',
    success: { main: '#4caf50' },
    error: { main: '#f44747' },
    warning: { main: '#ddb100' },
  },
  typography: {
    fontFamily: '"Consolas", "Courier New", "Lucida Console", monospace',
    fontSize: 12,
    h4: { fontSize: '14px', fontWeight: 600 },
    h5: { fontSize: '13px', fontWeight: 600 },
    h6: { fontSize: '12px', fontWeight: 600 },
    body1: { fontSize: '12px' },
    body2: { fontSize: '11px' },
    subtitle2: { fontSize: '11px' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box' },
        '::-webkit-scrollbar': { width: '8px', height: '8px' },
        '::-webkit-scrollbar-track': { background: '#1e1e1e' },
        '::-webkit-scrollbar-thumb': { background: '#454545', borderRadius: '4px' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#3c3c3c',
          padding: '3px 8px',
          fontSize: '12px',
          fontFamily: '"Consolas", "Courier New", monospace',
        },
        head: {
          backgroundColor: '#2d2d2d',
          color: '#9cdcfe',
          fontWeight: 700,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          padding: '5px 8px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#2a2d2e !important' },
          cursor: 'pointer',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '12px',
          borderRadius: '2px',
          minHeight: '24px',
          padding: '2px 10px',
        },
      },
      defaultProps: { size: 'small' },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#252526',
          border: '1px solid #454545',
          borderRadius: '4px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          fontWeight: 600,
          padding: '8px 16px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #454545',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: '18px', fontSize: '10px', borderRadius: '2px' },
        label: { padding: '0 6px' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '11px',
          backgroundColor: '#3c3c3c',
          border: '1px solid #454545',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: '12px', padding: '2px 8px', borderRadius: 0 },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontFamily: '"Consolas", "Courier New", monospace', fontSize: '12px' },
      },
    },
  },
});

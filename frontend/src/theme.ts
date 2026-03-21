import { createTheme } from '@mui/material/styles';

// Акцентный цвет — оранжевый, чуть менее насыщенный
const ACCENT_MAIN = '#F08B5C';
const ACCENT_RGB = '240, 139, 92';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ACCENT_MAIN,
      light: '#F5A87A',
      dark: '#D97A45',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#4A90E2', // Небесно-голубой
      light: '#6BA3E8',
      dark: '#357ABD',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#0A0E27', // Темный фон ночного интерьера
      paper: 'rgba(163, 159, 159, 0.64)', // Без backdrop-blur: только альфа
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    success: {
      main: '#4ECDC4',
      light: '#6ED4CD',
      dark: '#3AB5AE',
    },
    warning: {
      main: '#FFB347',
      light: '#FFC066',
      dark: '#E59F2E',
    },
    error: {
      main: '#FF6B6B',
      light: '#FF8A8A',
      dark: '#E55555',
    },
    info: {
      main: '#95E1D3',
      light: '#B0E8DD',
      dark: '#7AC9B8',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h5: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h6: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root, *': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.28) transparent',
        },
        '*::-webkit-scrollbar': {
          width: '10px',
          height: '10px',
          background: 'transparent',
        },
        '*::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          background: 'rgba(255, 255, 255, 0.28)',
          borderRadius: '999px',
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-button': {
          display: 'none',
          width: 0,
          height: 0,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.14)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          borderRadius: 4,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease',
          '&:hover': {
            boxShadow: `0 12px 40px 0 rgba(${ACCENT_RGB}, 0.3)`,
            transform: 'translateY(-4px)',
            border: `1px solid rgba(${ACCENT_RGB}, 0.4)`,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4,
          fontWeight: 500,
          padding: '10px 24px',
          background: 'rgba(255, 255, 255, 0.14)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#FFFFFF',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.2)',
            boxShadow: `0 4px 20px rgba(${ACCENT_RGB}, 0.4)`,
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
          minHeight: 48,
          color: 'rgba(255, 255, 255, 0.7)',
          '&.Mui-selected': {
            color: '#FFFFFF',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(74, 74, 74, 0.92)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.22)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: 'rgba(74, 74, 74, 0.92)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.22)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '& .MuiTabs-indicator': {
            backgroundColor: ACCENT_MAIN,
            height: 3,
            borderRadius: 4,
          },
        },
      },
    },
  },
});

// Глобальные стили для glassmorphism
export const glassmorphismStyles = {
  glass: {
    background: 'rgba(255, 255, 255, 0.14)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  },
  glassLight: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  glow: {
    boxShadow: '0 0 20px rgba(240, 139, 92, 0.5)',
  },
  glowSoft: {
    boxShadow: '0 0 10px rgba(240, 139, 92, 0.3)',
  },
};

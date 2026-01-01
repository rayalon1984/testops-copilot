import { createTheme, alpha, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    neutral: PaletteOptions['primary'];
  }
}

// --- LEGACY THEME (v2.5.5 and below) ---
const legacyThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#fff',
    },
    secondary: {
      main: '#8b5cf6',
      light: '#a78bfa',
      dark: '#7c3aed',
      contrastText: '#fff',
    },
    neutral: {
      main: '#64748b',
      light: '#94a3b8',
      dark: '#475569',
      contrastText: '#fff',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#fff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#fff',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#fff',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#fff',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
    divider: '#334155',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 600, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: '#1e293b', border: '1px solid #334155', boxShadow: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: '#1e293b', border: '1px solid #334155' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#1e293b', backgroundImage: 'none', borderBottom: '1px solid #334155' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#1e293b', borderRight: '1px solid #334155' },
      },
    },
  },
};

// --- MODERN THEME (Premium Dark) ---
const modernColors = {
  background: '#0A0A0A',
  paper: '#111111',
  primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrastText: '#fff' },
  secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrastText: '#fff' },
  success: { main: '#10b981', light: '#34d399', dark: '#059669' },
  error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
  warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
  info: { main: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
  text: { primary: '#f8fafc', secondary: '#94a3b8' },
  divider: 'rgba(148, 163, 184, 0.12)',
};

const modernThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    background: { default: modernColors.background, paper: modernColors.paper },
    primary: modernColors.primary,
    secondary: modernColors.secondary,
    success: modernColors.success,
    error: modernColors.error,
    warning: modernColors.warning,
    info: modernColors.info,
    text: modernColors.text,
    divider: modernColors.divider,
    neutral: { main: '#64748b', light: '#94a3b8', dark: '#475569', contrastText: '#fff' },
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 600, letterSpacing: '-0.025em' },
    h3: { fontWeight: 600, letterSpacing: '-0.025em' },
    h4: { fontWeight: 600, letterSpacing: '-0.025em' },
    h5: { fontWeight: 600, letterSpacing: '-0.025em' },
    h6: { fontWeight: 600, letterSpacing: '-0.025em' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#333 #0A0A0A',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': { width: '8px', height: '8px' },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': { borderRadius: 8, backgroundColor: '#333', border: '2px solid transparent', backgroundClip: 'content-box' },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(modernColors.paper, 0.6),
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(modernColors.primary.light, 0.08)}`,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: alpha(modernColors.primary.light, 0.2),
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: modernColors.paper },
        outlined: { border: `1px solid ${modernColors.divider}` },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: 'none' },
        containedPrimary: {
          background: `linear-gradient(135deg, ${modernColors.primary.main} 0%, ${modernColors.primary.dark} 100%)`,
          '&:hover': { background: `linear-gradient(135deg, ${modernColors.primary.light} 0%, ${modernColors.primary.main} 100%)` },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, backdropFilter: 'blur(4px)' },
        filled: { border: '1px solid transparent' },
        outlined: { border: `1px solid ${modernColors.divider}` },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${modernColors.divider}` },
        head: { fontWeight: 600, backgroundColor: alpha(modernColors.paper, 0.8), color: modernColors.text.secondary },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: alpha(modernColors.background, 0.8), backdropFilter: 'blur(12px)', borderBottom: `1px solid ${modernColors.divider}`, boxShadow: 'none' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: modernColors.background, borderRight: `1px solid ${modernColors.divider}` },
      },
    },
  },
};

export type DesignMode = 'legacy' | 'modern';

export const getAppTheme = (mode: DesignMode) => {
  return createTheme(mode === 'modern' ? modernThemeOptions : legacyThemeOptions);
};

// Default export for backward compatibility if needed, though we should use getAppTheme
export const theme = getAppTheme('modern');
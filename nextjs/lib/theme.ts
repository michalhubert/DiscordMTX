import { createTheme, type SxProps, type Theme } from '@mui/material/styles'

export const DEFAULT_ACCENT = '#ef4444'
export const ACCENT_COOKIE = 'discordmtx-accent'

export const ACCENT_PRESETS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#38bdf8',
  '#5865f2',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

// Theme colours are CSS variables, so translucent tints follow accent changes
// without regenerating any component styles.
export function accentAlpha(opacity: number): string {
  return `rgba(var(--mui-palette-primary-mainChannel) / ${opacity})`
}

export const glassSx = {
  bgcolor: 'rgba(0, 0, 0, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
  color: 'common.white',
} satisfies SxProps<Theme>

export const accentGlassSx = {
  ...glassSx,
  background: `linear-gradient(${accentAlpha(0.16)}, ${accentAlpha(0.06)}), rgba(0, 0, 0, 0.6)`,
  border: `1px solid ${accentAlpha(0.35)}`,
  boxShadow: `0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px ${accentAlpha(0.12)}`,
} satisfies SxProps<Theme>

export const popupSx = {
  bgcolor: 'rgba(23, 23, 28, 0.96)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(16px)',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
  color: 'common.white',
} satisfies SxProps<Theme>

// Portals land inside the fullscreen element when there is one, otherwise
// popups opened from the player would be invisible in fullscreen. Only called
// client-side, when the portal mounts.
const portalContainer = () => document.fullscreenElement ?? document.body

export function createAppTheme(accent: string) {
  return createTheme({
    cssVariables: true,
    palette: {
      mode: 'dark',
      primary: { main: isHexColor(accent) ? accent : DEFAULT_ACCENT },
      error: { main: '#ef4444' },
      warning: { main: '#f59e0b' },
      success: { main: '#22c55e' },
      info: { main: '#38bdf8' },
      discord: { main: '#5865f2', contrastText: '#ffffff' },
      background: { default: '#0b0b0f', paper: '#16161c' },
      divider: 'rgba(255, 255, 255, 0.08)',
      text: {
        primary: '#ececf1',
        secondary: 'rgba(255, 255, 255, 0.6)',
        disabled: 'rgba(255, 255, 255, 0.35)',
      },
    },
    breakpoints: {
      values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'var(--font-geist), system-ui, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { fontWeight: 600, letterSpacing: '0.06em', lineHeight: 1.6 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: 'antialiased' },
        },
      },
      MuiPopper: { defaultProps: { container: portalContainer } },
      MuiModal: { defaultProps: { container: portalContainer } },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiTooltip: {
        defaultProps: { disableInteractive: true },
        styleOverrides: {
          tooltip: {
            backgroundColor: 'rgba(23, 23, 28, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 10px',
          },
        },
      },
    },
  })
}

declare module '@mui/material/styles' {
  interface Palette {
    discord: Palette['primary']
  }
  interface PaletteOptions {
    discord?: PaletteOptions['primary']
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    discord: true
  }
}

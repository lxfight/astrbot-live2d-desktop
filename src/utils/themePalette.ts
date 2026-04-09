import type { GlobalThemeOverrides } from 'naive-ui'

export type ThemeRgb = {
  r: number
  g: number
  b: number
}

type ThemeHsl = {
  h: number
  s: number
  l: number
}

export type ThemePalette = {
  accent: string
  accentHover: string
  accentPressed: string
  accentSoft: string
  accentMuted: string
  accentGlow: string
  accentRgb: string
  accentContrast: string
  surfaceBase: string
  surfaceInset: string
  surfaceRaised: string
  surfaceFloating: string
  surfaceOverlay: string
  surfaceGlass: string
  surfaceGlassHover: string
  borderSubtle: string
  borderStrong: string
  borderAccent: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  success: string
  warning: string
  error: string
  info: string
  chartPalette: string[]
  shadowColor: string
}

const DEFAULT_RGB: ThemeRgb = { r: 116, g: 165, b: 255 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeChannel(value: number): number {
  return Math.round(clamp(value, 0, 255))
}

function normalizeRgb(rgb: ThemeRgb): ThemeRgb {
  return {
    r: normalizeChannel(rgb.r),
    g: normalizeChannel(rgb.g),
    b: normalizeChannel(rgb.b),
  }
}

function rgbToHsl(rgb: ThemeRgb): ThemeHsl {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0

  switch (max) {
    case r:
      hue = ((g - b) / delta) % 6
      break
    case g:
      hue = (b - r) / delta + 2
      break
    default:
      hue = (r - g) / delta + 4
      break
  }

  return {
    h: Math.round((hue * 60 + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function hslToRgb(hsl: ThemeHsl): ThemeRgb {
  const h = ((hsl.h % 360) + 360) % 360
  const s = clamp(hsl.s, 0, 100) / 100
  const l = clamp(hsl.l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = h / 60
  const x = chroma * (1 - Math.abs((segment % 2) - 1))
  const match = l - chroma / 2

  let r = 0
  let g = 0
  let b = 0

  if (segment >= 0 && segment < 1) {
    r = chroma
    g = x
  } else if (segment >= 1 && segment < 2) {
    r = x
    g = chroma
  } else if (segment >= 2 && segment < 3) {
    g = chroma
    b = x
  } else if (segment >= 3 && segment < 4) {
    g = x
    b = chroma
  } else if (segment >= 4 && segment < 5) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  return normalizeRgb({
    r: (r + match) * 255,
    g: (g + match) * 255,
    b: (b + match) * 255,
  })
}

function rgbToHex(rgb: ThemeRgb): string {
  const normalized = normalizeRgb(rgb)
  return `#${[normalized.r, normalized.g, normalized.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export function hexToRgb(hex: string | null | undefined): ThemeRgb {
  if (!hex) {
    return DEFAULT_RGB
  }

  const normalized = hex.trim().replace('#', '')
  const raw = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return DEFAULT_RGB
  }

  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

function rgba(rgb: ThemeRgb, alpha: number): string {
  const normalized = normalizeRgb(rgb)
  return `rgba(${normalized.r}, ${normalized.g}, ${normalized.b}, ${alpha})`
}

function mixRgb(a: ThemeRgb, b: ThemeRgb, ratio: number): ThemeRgb {
  const t = clamp(ratio, 0, 1)
  return normalizeRgb({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

function shiftLightness(rgb: ThemeRgb, delta: number, saturationDelta = 0): ThemeRgb {
  const hsl = rgbToHsl(rgb)
  return hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s + saturationDelta, 18, 88),
    l: clamp(hsl.l + delta, 12, 88),
  })
}

function rotateHue(rgb: ThemeRgb, delta: number, lightnessDelta = 0): ThemeRgb {
  const hsl = rgbToHsl(rgb)
  return hslToRgb({
    h: hsl.h + delta,
    s: clamp(hsl.s - 4, 22, 78),
    l: clamp(hsl.l + lightnessDelta, 20, 82),
  })
}

function relativeLuminance(rgb: ThemeRgb): number {
  const transform = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const r = transform(rgb.r)
  const g = transform(rgb.g)
  const b = transform(rgb.b)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function normalizeAccent(rgb: ThemeRgb): ThemeRgb {
  const source = normalizeRgb(rgb)
  const hsl = rgbToHsl(source)
  const adjusted = hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s < 28 ? hsl.s + 14 : hsl.s, 28, 90),
    l: clamp(
      hsl.l < 34 ? hsl.l + 10 : (hsl.l > 72 ? hsl.l - 12 : hsl.l),
      34,
      72,
    ),
  })

  return mixRgb(source, adjusted, 0.42)
}

export function createThemePalette(rgb: ThemeRgb): ThemePalette {
  const accentRgb = normalizeAccent(rgb)
  const accentHoverRgb = shiftLightness(accentRgb, 6, 4)
  const accentPressedRgb = shiftLightness(accentRgb, -8, -2)
  const baseTint = mixRgb(accentRgb, { r: 8, g: 12, b: 20 }, 0.9)
  const insetTint = mixRgb(accentRgb, { r: 11, g: 16, b: 28 }, 0.86)
  const raisedTint = mixRgb(accentRgb, { r: 15, g: 20, b: 34 }, 0.8)
  const floatingTint = mixRgb(accentRgb, { r: 20, g: 26, b: 42 }, 0.74)
  const overlayTint = mixRgb(accentRgb, { r: 28, g: 35, b: 56 }, 0.68)
  const accentContrast = relativeLuminance(accentRgb) > 0.42 ? '#07111e' : '#f8fbff'

  return {
    accent: rgbToHex(accentRgb),
    accentHover: rgbToHex(accentHoverRgb),
    accentPressed: rgbToHex(accentPressedRgb),
    accentSoft: rgba(accentRgb, 0.18),
    accentMuted: rgba(accentRgb, 0.08),
    accentGlow: rgba(accentRgb, 0.36),
    accentRgb: `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    accentContrast,
    surfaceBase: rgbToHex(baseTint),
    surfaceInset: rgbToHex(insetTint),
    surfaceRaised: rgbToHex(raisedTint),
    surfaceFloating: rgbToHex(floatingTint),
    surfaceOverlay: rgbToHex(overlayTint),
    surfaceGlass: rgba(floatingTint, 0.72),
    surfaceGlassHover: rgba(overlayTint, 0.82),
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    borderAccent: rgba(accentRgb, 0.42),
    textPrimary: 'rgba(247, 249, 252, 0.96)',
    textSecondary: 'rgba(185, 192, 207, 0.82)',
    textTertiary: 'rgba(132, 141, 160, 0.68)',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    chartPalette: [
      rgbToHex(accentRgb),
      rgbToHex(rotateHue(accentRgb, 26, 6)),
      rgbToHex(rotateHue(accentRgb, -22, 4)),
      rgbToHex(rotateHue(accentRgb, 52, 10)),
      rgbToHex(rotateHue(accentRgb, -48, 8)),
      rgbToHex(shiftLightness(accentRgb, -12, -6)),
    ],
    shadowColor: rgba(accentRgb, 0.22),
  }
}

export function withAlpha(hex: string, alpha: number): string {
  return rgba(hexToRgb(hex), alpha)
}

export function buildThemeCssVars(palette: ThemePalette, modelName?: string): Record<string, string> {
  const chartVars = palette.chartPalette.reduce<Record<string, string>>((accumulator, color, index) => {
    accumulator[`--theme-chart-${index}`] = color
    return accumulator
  }, {})

  return {
    '--theme-model-name': modelName || 'AstrBot Live2D',
    '--color-bg-base': palette.surfaceBase,
    '--color-bg-dark': palette.surfaceInset,
    '--color-bg-light': palette.surfaceRaised,
    '--color-bg-elevated': palette.surfaceFloating,
    '--color-bg-hover': palette.surfaceOverlay,
    '--surface-bg': palette.surfaceGlass,
    '--surface-bg-hover': palette.surfaceGlassHover,
    '--surface-border': palette.borderSubtle,
    '--surface-border-hover': palette.borderStrong,
    '--color-text-primary': palette.textPrimary,
    '--color-text-secondary': palette.textSecondary,
    '--color-text-tertiary': palette.textTertiary,
    '--color-accent': palette.accent,
    '--color-accent-hover': palette.accentHover,
    '--color-accent-pressed': palette.accentPressed,
    '--color-accent-soft': palette.accentSoft,
    '--color-accent-muted': palette.accentMuted,
    '--color-accent-glow': palette.accentGlow,
    '--color-accent-rgb': palette.accentRgb,
    '--color-success': palette.success,
    '--color-success-soft': withAlpha(palette.success, 0.16),
    '--color-error': palette.error,
    '--color-error-soft': withAlpha(palette.error, 0.16),
    '--color-warning': palette.warning,
    '--color-warning-soft': withAlpha(palette.warning, 0.16),
    '--color-info': palette.info,
    '--color-border': palette.borderSubtle,
    '--color-border-hover': palette.borderStrong,
    '--color-border-active': palette.borderAccent,
    '--color-shadow-accent': palette.shadowColor,
    '--theme-chart-surface': withAlpha(palette.accent, 0.06),
    '--theme-chart-grid': 'rgba(255, 255, 255, 0.08)',
    '--theme-chart-text': palette.textSecondary,
    '--theme-accent-contrast': palette.accentContrast,
    ...chartVars,
  }
}

export function buildNaiveThemeOverrides(palette: ThemePalette): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: palette.accent,
      primaryColorHover: palette.accentHover,
      primaryColorPressed: palette.accentPressed,
      primaryColorSuppl: palette.accentHover,
      infoColor: palette.info,
      successColor: palette.success,
      warningColor: palette.warning,
      errorColor: palette.error,
      bodyColor: palette.surfaceBase,
      cardColor: palette.surfaceFloating,
      modalColor: 'rgba(26, 33, 44, 0.65)',
      popoverColor: 'rgba(20, 26, 36, 0.75)',
      inputColor: 'rgba(255, 255, 255, 0.03)',
      tableColor: palette.surfaceRaised,
      actionColor: palette.surfaceRaised,
      hoverColor: palette.accentMuted,
      borderColor: palette.borderSubtle,
      dividerColor: palette.borderSubtle,
      textColorBase: palette.textPrimary,
      textColor1: palette.textPrimary,
      textColor2: palette.textSecondary,
      textColor3: palette.textTertiary,
      borderRadius: '16px',
      borderRadiusSmall: '12px',
      heightMedium: '44px',
      heightLarge: '50px',
      fontSize: '14px',
      fontSizeMedium: '14px',
    },
    Button: {
      borderRadiusMedium: '16px',
      borderRadiusSmall: '14px',
      colorPrimaryHover: palette.accentHover,
      colorPrimaryPressed: palette.accentPressed,
      textColorPrimary: palette.accentContrast,
      rippleColorPrimary: palette.accentSoft,
    },
    Card: {
      borderRadius: '24px',
      color: 'rgba(26, 33, 44, 0.45)',
      borderColor: palette.borderSubtle,
      titleTextColor: palette.textPrimary,
      textColor: palette.textSecondary,
    },
    Input: {
      borderRadius: '16px',
      color: 'rgba(255, 255, 255, 0.03)',
      colorFocus: 'rgba(255, 255, 255, 0.06)',
      colorFocusError: 'rgba(248, 113, 113, 0.1)',
      borderHover: `1px solid ${palette.borderStrong}`,
      borderFocus: `1px solid ${palette.borderAccent}`,
      boxShadowFocus: `0 0 0 3px ${palette.accentSoft}, 0 2px 10px rgba(0, 0, 0, 0.1)`,
    },
    Select: {
      peers: {
        InternalSelection: {
          borderFocus: `1px solid ${palette.borderAccent}`,
          boxShadowFocus: `0 0 0 3px ${palette.accentSoft}, 0 2px 10px rgba(0, 0, 0, 0.1)`,
        },
      },
    },
    Tabs: {
      tabBorderRadius: '999px',
      tabTextColorActiveLine: palette.textPrimary,
      barColor: palette.accent,
    },
    Switch: {
      railColorActive: palette.accent,
      buttonColor: '#ffffff',
    },
    Alert: {
      borderRadius: '18px',
      color: 'rgba(255, 255, 255, 0.05)',
    },
    Dialog: {
      borderRadius: '24px',
      color: 'rgba(26, 33, 44, 0.75)',
    },
    Drawer: {
      color: 'rgba(20, 26, 36, 0.85)',
    },
    Tag: {
      borderRadius: '999px',
    },
    Statistic: {
      labelTextColor: palette.textSecondary,
      valueTextColor: palette.textPrimary,
    },
    DataTable: {
      tdColor: palette.surfaceRaised,
      thColor: palette.surfaceInset,
      borderColor: palette.borderSubtle,
    },
    Collapse: {
      dividerColor: palette.borderSubtle,
      titleTextColor: palette.textPrimary,
      textColor: palette.textSecondary,
    },
    DatePicker: {
      panelColor: 'rgba(20, 26, 36, 0.85)',
      panelBorderRadius: '20px',
    },
  }
}

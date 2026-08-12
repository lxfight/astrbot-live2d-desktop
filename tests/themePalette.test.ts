import { describe, expect, it } from 'vitest'
import { hexToRgb, createThemePalette, withAlpha, buildThemeCssVars } from '@/utils/themePalette'

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#74a5ff')).toEqual({ r: 116, g: 165, b: 255 })
  })

  it('parses 3-digit shorthand', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 })
  })

  it('handles missing hash and whitespace', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('  #ff0000  ')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('falls back to default for invalid input', () => {
    expect(hexToRgb(null)).toEqual({ r: 116, g: 165, b: 255 })
    expect(hexToRgb(undefined)).toEqual({ r: 116, g: 165, b: 255 })
    expect(hexToRgb('')).toEqual({ r: 116, g: 165, b: 255 })
    expect(hexToRgb('#12')).toEqual({ r: 116, g: 165, b: 255 })
    expect(hexToRgb('nonsense')).toEqual({ r: 116, g: 165, b: 255 })
  })
})

describe('createThemePalette', () => {
  it('creates palette with all required keys', () => {
    const palette = createThemePalette({ r: 116, g: 165, b: 255 })

    expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.accentHover).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.accentPressed).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.accentSoft).toMatch(/^rgba\(\d+, \d+, \d+, 0\.18\)$/)
    expect(palette.accentRgb).toMatch(/^\d+, \d+, \d+$/)
    expect(palette.chartPalette).toHaveLength(6)
    expect(palette.surfaceBase).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.success).toBe('#34d399')
    expect(palette.warning).toBe('#fbbf24')
    expect(palette.error).toBe('#f87171')
  })

  it('picks dark contrast for bright accents and light for dark accents', () => {
    const bright = createThemePalette({ r: 255, g: 255, b: 255 })
    expect(bright.accentContrast).toBe('#07111e')

    const dark = createThemePalette({ r: 10, g: 10, b: 10 })
    expect(dark.accentContrast).toBe('#f8fbff')
  })

  it('clamps out-of-range channels', () => {
    const palette = createThemePalette({ r: 300, g: -50, b: 128 })
    expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.accentRgb).not.toContain('300')
  })
})

describe('withAlpha', () => {
  it('converts hex to rgba with given alpha', () => {
    expect(withAlpha('#74a5ff', 0.5)).toBe('rgba(116, 165, 255, 0.5)')
  })

  it('handles non-hex strings via default', () => {
    expect(withAlpha('not-a-color', 0.2)).toBe('rgba(116, 165, 255, 0.2)')
  })
})

describe('buildThemeCssVars', () => {
  it('builds css variable record', () => {
    const palette = createThemePalette({ r: 116, g: 165, b: 255 })
    const vars = buildThemeCssVars(palette)

    expect(vars['--color-accent']).toBe(palette.accent)
    expect(vars['--theme-chart-0']).toBe(palette.chartPalette[0])
    expect(vars['--theme-chart-5']).toBe(palette.chartPalette[5])
    expect(vars['--color-bg-base']).toBe(palette.surfaceBase)
    expect(vars['--color-accent-rgb']).toBe(palette.accentRgb)
    expect(vars['--color-success']).toBe(palette.success)
  })

  it('includes model name var when provided', () => {
    const palette = createThemePalette({ r: 116, g: 165, b: 255 })
    const vars = buildThemeCssVars(palette, 'My Model')

    expect(vars['--theme-model-name']).toBe('My Model')
  })

  it('defaults model name when omitted', () => {
    const palette = createThemePalette({ r: 116, g: 165, b: 255 })
    const vars = buildThemeCssVars(palette)

    expect(vars['--theme-model-name']).toBe('AstrBot Live2D')
  })
})

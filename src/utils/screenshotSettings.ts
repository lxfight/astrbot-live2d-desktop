export type ScreenshotDefaultTarget = 'active' | 'desktop'

export interface ScreenshotSettings {
  defaultTarget: ScreenshotDefaultTarget
  quality: number
  maxWidth: number
}

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
  defaultTarget: 'active',
  quality: 80,
  maxWidth: 1920,
}

export function clampScreenshotQuality(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SCREENSHOT_SETTINGS.quality
  }

  return Math.max(30, Math.min(100, Math.round(numericValue)))
}

export function clampScreenshotMaxWidth(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SCREENSHOT_SETTINGS.maxWidth
  }

  return Math.max(640, Math.min(3840, Math.round(numericValue)))
}

export function normalizeScreenshotSettings(value: unknown): ScreenshotSettings {
  const raw = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}

  return {
    defaultTarget: raw.defaultTarget === 'desktop' ? 'desktop' : 'active',
    quality: clampScreenshotQuality(raw.quality),
    maxWidth: clampScreenshotMaxWidth(raw.maxWidth),
  }
}

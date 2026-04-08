export interface DesktopFeatureSettings {
  alwaysOnTop: boolean
  fullPassThrough: boolean
  dynamicPassThrough: boolean
  autoDetectFullscreen: boolean
}

export const DEFAULT_DESKTOP_FEATURE_SETTINGS: DesktopFeatureSettings = {
  alwaysOnTop: true,
  fullPassThrough: false,
  dynamicPassThrough: true,
  autoDetectFullscreen: false,
}

export function normalizeDesktopFeatureSettings(value: unknown): DesktopFeatureSettings {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}

  return {
    alwaysOnTop: typeof raw.alwaysOnTop === 'boolean'
      ? raw.alwaysOnTop
      : DEFAULT_DESKTOP_FEATURE_SETTINGS.alwaysOnTop,
    fullPassThrough: typeof raw.fullPassThrough === 'boolean'
      ? raw.fullPassThrough
      : DEFAULT_DESKTOP_FEATURE_SETTINGS.fullPassThrough,
    dynamicPassThrough: typeof raw.dynamicPassThrough === 'boolean'
      ? raw.dynamicPassThrough
      : DEFAULT_DESKTOP_FEATURE_SETTINGS.dynamicPassThrough,
    autoDetectFullscreen: typeof raw.autoDetectFullscreen === 'boolean'
      ? raw.autoDetectFullscreen
      : DEFAULT_DESKTOP_FEATURE_SETTINGS.autoDetectFullscreen,
  }
}

export function mergeDesktopFeatureSettings(
  current: unknown,
  patch: unknown,
): DesktopFeatureSettings {
  const normalizedCurrent = normalizeDesktopFeatureSettings(current)
  const normalizedPatch = normalizeDesktopFeatureSettings({
    ...normalizedCurrent,
    ...(patch && typeof patch === 'object' ? patch as Record<string, unknown> : {}),
  })

  return {
    alwaysOnTop: normalizedPatch.alwaysOnTop,
    fullPassThrough: normalizedPatch.fullPassThrough,
    dynamicPassThrough: normalizedPatch.dynamicPassThrough,
    autoDetectFullscreen: normalizedPatch.autoDetectFullscreen,
  }
}

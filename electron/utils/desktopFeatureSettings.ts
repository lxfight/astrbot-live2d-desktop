import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import {
  DEFAULT_DESKTOP_FEATURE_SETTINGS,
  mergeDesktopFeatureSettings,
  type DesktopFeatureSettings,
} from '../../src/utils/desktopFeatureSettings'

const DESKTOP_FEATURE_SETTING_KEYS = {
  alwaysOnTop: USER_CONFIG_KEYS.alwaysOnTop,
  fullPassThrough: USER_CONFIG_KEYS.fullPassThrough,
  autoDetectFullscreen: USER_CONFIG_KEYS.autoDetectFullscreen,
} as const

function parseStoredBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  return value === 'true'
}

export function loadDesktopFeatureSettings(): DesktopFeatureSettings {
  return {
    alwaysOnTop: parseStoredBoolean(
      getUserConfig(DESKTOP_FEATURE_SETTING_KEYS.alwaysOnTop),
      DEFAULT_DESKTOP_FEATURE_SETTINGS.alwaysOnTop,
    ),
    fullPassThrough: parseStoredBoolean(
      getUserConfig(DESKTOP_FEATURE_SETTING_KEYS.fullPassThrough),
      DEFAULT_DESKTOP_FEATURE_SETTINGS.fullPassThrough,
    ),
    autoDetectFullscreen: parseStoredBoolean(
      getUserConfig(DESKTOP_FEATURE_SETTING_KEYS.autoDetectFullscreen),
      DEFAULT_DESKTOP_FEATURE_SETTINGS.autoDetectFullscreen,
    ),
  }
}

export function saveDesktopFeatureSettings(
  patch: Partial<DesktopFeatureSettings>,
): DesktopFeatureSettings {
  const nextSettings = mergeDesktopFeatureSettings(loadDesktopFeatureSettings(), patch)

  setUserConfig(DESKTOP_FEATURE_SETTING_KEYS.alwaysOnTop, String(nextSettings.alwaysOnTop))
  setUserConfig(DESKTOP_FEATURE_SETTING_KEYS.fullPassThrough, String(nextSettings.fullPassThrough))
  setUserConfig(DESKTOP_FEATURE_SETTING_KEYS.autoDetectFullscreen, String(nextSettings.autoDetectFullscreen))

  return nextSettings
}

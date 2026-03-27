import { getUserConfig, setUserConfig } from '../database/schema'
import {
  DEFAULT_DESKTOP_FEATURE_SETTINGS,
  mergeDesktopFeatureSettings,
  type DesktopFeatureSettings,
} from '../../src/utils/desktopFeatureSettings'

const DESKTOP_FEATURE_SETTING_KEYS = {
  alwaysOnTop: 'tray_always_on_top',
  fullPassThrough: 'tray_pass_through_mode',
  autoDetectFullscreen: 'tray_game_mode',
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

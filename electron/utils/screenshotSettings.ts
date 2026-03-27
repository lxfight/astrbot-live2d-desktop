import { getUserConfig, setUserConfig } from '../database/schema'
import { DEFAULT_SCREENSHOT_SETTINGS, normalizeScreenshotSettings, type ScreenshotSettings } from '../../src/utils/screenshotSettings'

const SCREENSHOT_SETTING_KEYS = {
  defaultTarget: 'desktop_capture_default_target',
  quality: 'desktop_capture_quality',
  maxWidth: 'desktop_capture_max_width',
} as const

export function loadScreenshotSettings(): ScreenshotSettings {
  return normalizeScreenshotSettings({
    defaultTarget: getUserConfig(SCREENSHOT_SETTING_KEYS.defaultTarget) ?? DEFAULT_SCREENSHOT_SETTINGS.defaultTarget,
    quality: getUserConfig(SCREENSHOT_SETTING_KEYS.quality) ?? DEFAULT_SCREENSHOT_SETTINGS.quality,
    maxWidth: getUserConfig(SCREENSHOT_SETTING_KEYS.maxWidth) ?? DEFAULT_SCREENSHOT_SETTINGS.maxWidth,
  })
}

export function saveScreenshotSettings(patch: Partial<ScreenshotSettings>): ScreenshotSettings {
  const nextSettings = normalizeScreenshotSettings({
    ...loadScreenshotSettings(),
    ...patch,
  })

  setUserConfig(SCREENSHOT_SETTING_KEYS.defaultTarget, nextSettings.defaultTarget)
  setUserConfig(SCREENSHOT_SETTING_KEYS.quality, String(nextSettings.quality))
  setUserConfig(SCREENSHOT_SETTING_KEYS.maxWidth, String(nextSettings.maxWidth))
  return nextSettings
}

import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import { DEFAULT_SCREENSHOT_SETTINGS, normalizeScreenshotSettings, type ScreenshotSettings } from '../../src/utils/screenshotSettings'

const SCREENSHOT_SETTING_KEYS = {
  defaultTarget: USER_CONFIG_KEYS.screenshotDefaultTarget,
  quality: USER_CONFIG_KEYS.screenshotQuality,
  maxWidth: USER_CONFIG_KEYS.screenshotMaxWidth,
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

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SCREENSHOT_SETTINGS,
  clampScreenshotMaxWidth,
  clampScreenshotQuality,
  normalizeScreenshotSettings,
} from '../src/utils/screenshotSettings'

describe('screenshotSettings', () => {
  it('clamps screenshot quality and max width into supported ranges', () => {
    expect(clampScreenshotQuality(0)).toBe(30)
    expect(clampScreenshotQuality(200)).toBe(100)
    expect(clampScreenshotMaxWidth(100)).toBe(640)
    expect(clampScreenshotMaxWidth(9999)).toBe(3840)
  })

  it('normalizes persisted screenshot settings', () => {
    expect(normalizeScreenshotSettings({
      defaultTarget: 'desktop',
      quality: 72,
      maxWidth: 1600,
    })).toEqual({
      defaultTarget: 'desktop',
      quality: 72,
      maxWidth: 1600,
    })
  })

  it('falls back to defaults for invalid values', () => {
    expect(normalizeScreenshotSettings({ defaultTarget: 'window' })).toEqual(DEFAULT_SCREENSHOT_SETTINGS)
  })
})

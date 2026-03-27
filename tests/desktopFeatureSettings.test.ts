import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DESKTOP_FEATURE_SETTINGS,
  mergeDesktopFeatureSettings,
  normalizeDesktopFeatureSettings,
} from '../src/utils/desktopFeatureSettings'

describe('desktopFeatureSettings', () => {
  it('falls back to defaults for invalid values', () => {
    expect(normalizeDesktopFeatureSettings({ alwaysOnTop: 'yes' })).toEqual(DEFAULT_DESKTOP_FEATURE_SETTINGS)
  })

  it('normalizes explicit desktop feature flags', () => {
    expect(normalizeDesktopFeatureSettings({
      alwaysOnTop: false,
      fullPassThrough: true,
      autoDetectFullscreen: true,
    })).toEqual({
      alwaysOnTop: false,
      fullPassThrough: true,
      autoDetectFullscreen: true,
    })
  })

  it('merges partial updates onto existing settings', () => {
    expect(mergeDesktopFeatureSettings({
      alwaysOnTop: false,
      fullPassThrough: false,
      autoDetectFullscreen: false,
    }, {
      fullPassThrough: true,
    })).toEqual({
      alwaysOnTop: false,
      fullPassThrough: true,
      autoDetectFullscreen: false,
    })
  })
})

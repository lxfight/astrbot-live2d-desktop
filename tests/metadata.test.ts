import { describe, expect, it } from 'vitest'

import {
  APP_LINKS,
  APP_METADATA,
  LOCAL_STORAGE_METADATA,
  PROTOCOL_VERSION,
  SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS,
  USER_CONFIG_KEYS,
} from '../src/shared/metadata'

describe('metadata', () => {
  it('exposes app metadata from a single typed entry', () => {
    expect(APP_METADATA.displayName).toBe('AstrBot Live2D Desktop')
    expect(APP_METADATA.appId).toBe('com.astrbot.live2d.desktop')
    expect(APP_METADATA.authorName).toBe('lxfight')
    expect(APP_LINKS.repository).toBe('https://github.com/lxfight/astrbot-live2d-desktop')
  })

  it('centralizes protocol version and local storage definitions', () => {
    expect(PROTOCOL_VERSION).toBe('1.0.0')
    expect(LOCAL_STORAGE_METADATA.advancedSettings).toEqual({
      key: 'advancedSettings',
      version: 1,
    })
    expect(LOCAL_STORAGE_METADATA.connectionSettings).toEqual({
      key: 'connectionSettings',
      version: 2,
    })
    expect(LOCAL_STORAGE_METADATA.lastModelPath).toEqual({
      key: 'lastModelPath',
    })
    expect(SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS).toEqual([
      'lastModelPath',
      'advancedSettings',
      'connectionSettings',
      'rendererThemeState',
    ])
  })

  it('centralizes main-process user config keys', () => {
    expect(USER_CONFIG_KEYS).toEqual({
      autoUpdateEnabled: 'app_auto_update_enabled',
      screenshotDefaultTarget: 'desktop_capture_default_target',
      screenshotQuality: 'desktop_capture_quality',
      screenshotMaxWidth: 'desktop_capture_max_width',
      alwaysOnTop: 'tray_always_on_top',
      fullPassThrough: 'tray_pass_through_mode',
      autoDetectFullscreen: 'tray_game_mode',
    })
  })
})

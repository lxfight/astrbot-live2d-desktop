import { describe, expect, it } from 'vitest'

import { appMatchesTokens, resolveAppIdentity } from '../electron/desktopAwareness/appIdentity'
import {
  migrateLegacyWatcherConfig,
  validateDesktopAwarenessSettings
} from '../electron/desktopAwareness/settings'
import type { WindowWatcherConfig } from '../electron/utils/windowWatcherConfig'

describe('desktopAwareness app identity', () => {
  it('normalizes Chrome aliases across platforms', () => {
    const windowsChrome = resolveAppIdentity({ processName: 'chrome.exe' })
    const macChrome = resolveAppIdentity({
      processName: 'Google Chrome',
      bundleId: 'com.google.Chrome'
    })
    const linuxChrome = resolveAppIdentity({ processName: 'google-chrome' })

    expect(windowsChrome.canonicalKey).toBe('chrome')
    expect(macChrome.canonicalKey).toBe('chrome')
    expect(linuxChrome.canonicalKey).toBe('chrome')
    expect(appMatchesTokens(windowsChrome, ['Chrome'])).toBe(true)
    expect(appMatchesTokens(macChrome, ['chrome.exe'])).toBe(true)
  })

  it('uses bundle and app ids as app match keys', () => {
    const edge = resolveAppIdentity({
      processName: 'Microsoft Edge',
      bundleId: 'com.microsoft.edgemac'
    })

    expect(edge.canonicalKey).toBe('edge')
    expect(appMatchesTokens(edge, ['msedge.exe'])).toBe(true)
    expect(appMatchesTokens(edge, ['com.microsoft.edgemac'])).toBe(true)
  })

  it('marks common shell windows as system apps', () => {
    expect(resolveAppIdentity({ processName: 'explorer.exe' }).isSystem).toBe(true)
    expect(resolveAppIdentity({ processName: 'TextInputHost.exe' }).isSystem).toBe(true)
  })
})

describe('desktopAwareness settings', () => {
  it('validates partial user settings', () => {
    const settings = validateDesktopAwarenessSettings({
      mode: 'active',
      appScope: {
        mode: 'include',
        apps: [' Chrome ', '', 'Chrome', 'VS Code']
      }
    })

    expect(settings.enabled).toBe(true)
    expect(settings.mode).toBe('active')
    expect(settings.appScope.mode).toBe('include')
    expect(settings.appScope.apps).toEqual(['Chrome', 'VS Code'])
  })

  it('migrates legacy specific app mode to include scope', () => {
    const legacy: WindowWatcherConfig = {
      enabled: true,
      appLaunchEnabled: true,
      throttle: { globalInterval: 1000, perWindowInterval: 3000, minInterval: 100 },
      events: {
        focus: true,
        blur: false,
        create: true,
        destroy: false,
        resize: false,
        move: false,
        minimize: false,
        maximize: false,
        restore: false,
        fullscreen: true,
        windowed: false
      },
      ignore: {
        processNames: [],
        titleKeywords: []
      },
      aiResponse: {
        mode: 'specific-apps',
        specificApps: ['chrome.exe']
      }
    }

    expect(migrateLegacyWatcherConfig(legacy)).toMatchObject({
      enabled: true,
      mode: 'smart',
      appScope: {
        mode: 'include',
        apps: ['chrome.exe']
      }
    })
  })
})

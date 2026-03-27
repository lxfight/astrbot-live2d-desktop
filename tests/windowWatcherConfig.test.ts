import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, validateConfig } from '../electron/utils/windowWatcherConfig'

describe('windowWatcherConfig', () => {
  it('includes app launch watcher enabled by default', () => {
    expect(DEFAULT_CONFIG.appLaunchEnabled).toBe(true)
  })

  it('normalizes app launch watcher toggle from partial config', () => {
    expect(validateConfig({ appLaunchEnabled: false }).appLaunchEnabled).toBe(false)
    expect(validateConfig({ appLaunchEnabled: 'false' as never }).appLaunchEnabled).toBe(true)
  })
})

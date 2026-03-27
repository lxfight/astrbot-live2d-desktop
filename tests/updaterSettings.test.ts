import { describe, expect, it } from 'vitest'

import { DEFAULT_UPDATER_SETTINGS, normalizeUpdaterSettings } from '../src/utils/updaterSettings'

describe('updaterSettings', () => {
  it('uses defaults for invalid persisted values', () => {
    expect(normalizeUpdaterSettings({ autoUpdateEnabled: 'yes' })).toEqual(DEFAULT_UPDATER_SETTINGS)
  })

  it('normalizes explicit auto update preference', () => {
    expect(normalizeUpdaterSettings({ autoUpdateEnabled: false })).toEqual({
      autoUpdateEnabled: false,
    })
  })
})

import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import { DEFAULT_UPDATER_SETTINGS, type UpdaterSettings } from '../../src/utils/updaterSettings'

const AUTO_UPDATE_KEY = USER_CONFIG_KEYS.autoUpdateEnabled

export function loadUpdaterSettings(): UpdaterSettings {
  const stored = getUserConfig(AUTO_UPDATE_KEY)
  if (stored === null) {
    return { ...DEFAULT_UPDATER_SETTINGS }
  }

  return {
    autoUpdateEnabled: stored === 'true',
  }
}

export function saveUpdaterSettings(
  patch: Partial<UpdaterSettings>,
): UpdaterSettings {
  const current = loadUpdaterSettings()
  const nextSettings: UpdaterSettings = {
    autoUpdateEnabled: typeof patch.autoUpdateEnabled === 'boolean'
      ? patch.autoUpdateEnabled
      : current.autoUpdateEnabled,
  }

  setUserConfig(AUTO_UPDATE_KEY, String(nextSettings.autoUpdateEnabled))
  return nextSettings
}

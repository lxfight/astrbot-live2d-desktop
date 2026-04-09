import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import { DEFAULT_UPDATER_SETTINGS, type UpdaterSettings } from '../../src/utils/updaterSettings'

const AUTO_UPDATE_KEY = USER_CONFIG_KEYS.autoUpdateEnabled

export function loadUpdaterSettings(): UpdaterSettings {
  let stored: string | null
  try {
    stored = getUserConfig(AUTO_UPDATE_KEY)
  } catch (error) {
    console.warn('[更新器] 读取自动更新设置失败，使用默认值:', error)
    return { ...DEFAULT_UPDATER_SETTINGS }
  }

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

  try {
    setUserConfig(AUTO_UPDATE_KEY, String(nextSettings.autoUpdateEnabled))
  } catch (error) {
    console.warn('[更新器] 保存自动更新设置失败，保留当前值:', error)
    return current
  }

  return nextSettings
}

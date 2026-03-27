export interface UpdaterSettings {
  autoUpdateEnabled: boolean
}

export const DEFAULT_UPDATER_SETTINGS: UpdaterSettings = {
  autoUpdateEnabled: true,
}

export function normalizeUpdaterSettings(value: unknown): UpdaterSettings {
  const raw = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}

  return {
    autoUpdateEnabled: typeof raw.autoUpdateEnabled === 'boolean'
      ? raw.autoUpdateEnabled
      : DEFAULT_UPDATER_SETTINGS.autoUpdateEnabled,
  }
}

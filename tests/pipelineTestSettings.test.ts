import { describe, expect, it } from 'vitest'
import { settingsMenuGroups } from '../src/windows/settings/settingsMenu'
import { createSettingsSectionRegistry } from '../src/windows/settings/settingsRegistry'

function createDomains() {
  return {
    advancedDomain: {
      ensureBaseReady: async () => {},
      ensureBehaviorReady: async () => {},
      ensureShortcutReady: async () => {}
    },
    aboutDomain: { ensureReady: async () => {} },
    connectionDomain: { refreshConnectionState: async () => {} },
    historyDomain: {
      ensureMessagesReady: async () => {},
      ensureStatisticsReady: async () => {}
    },
    maintenanceDomain: { ensureStorageOverviewReady: async () => {} },
    modelDomain: { ensureLibraryReady: async () => {} },
    watcherDomain: { ensureReady: async () => {} }
  } as any
}

describe('pipeline test settings entry', () => {
  it('registers the lightweight pipeline test section without model assets', () => {
    const advanced = settingsMenuGroups.find(group => group.key === 'advanced')
    expect(advanced?.children.some(child => child.key === 'pipelineTest')).toBe(true)

    const registry = createSettingsSectionRegistry(createDomains())
    expect(registry['advanced/pipelineTest']).toMatchObject({
      group: 'advanced',
      child: 'pipelineTest',
      cachePolicy: 'discard',
      skeletonKind: 'dense'
    })
  })
})

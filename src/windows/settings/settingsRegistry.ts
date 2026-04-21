import type { Component } from 'vue'
import type { SettingsChildKey, SettingsGroupKey } from './settingsMenu'
import type { ConnectionSettingsDomain } from './domains/createConnectionSettingsDomain'
import type { ModelSettingsDomain } from './domains/createModelSettingsDomain'
import type { AdvancedSettingsDomain } from './domains/createAdvancedSettingsDomain'
import type { WatcherSettingsDomain } from './domains/createWatcherSettingsDomain'
import type { AboutSettingsDomain } from './domains/createAboutSettingsDomain'
import type { HistorySettingsDomain } from './domains/createHistorySettingsDomain'

export type SettingsSectionCachePolicy = 'keep-alive' | 'discard'
export type SettingsSectionSkeletonKind = 'form' | 'list' | 'dense'

export interface SettingsSectionRegistryEntry {
  key: string
  group: SettingsGroupKey
  child: SettingsChildKey
  cachePolicy: SettingsSectionCachePolicy
  skeletonKind: SettingsSectionSkeletonKind
  loader: () => Promise<{ default: Component }>
  prepare?: (force?: boolean) => Promise<void>
}

export type SettingsSectionRegistry = Record<string, SettingsSectionRegistryEntry>

export interface SettingsSectionRegistryDomains {
  advancedDomain: AdvancedSettingsDomain
  aboutDomain: AboutSettingsDomain
  connectionDomain: ConnectionSettingsDomain
  historyDomain: HistorySettingsDomain
  modelDomain: ModelSettingsDomain
  watcherDomain: WatcherSettingsDomain
}

export function getSettingsSectionKey(group: SettingsGroupKey, child: SettingsChildKey): string {
  return `${group}/${child}`
}

export function getSettingsSectionEntry(
  registry: SettingsSectionRegistry,
  group: SettingsGroupKey,
  child: SettingsChildKey,
): SettingsSectionRegistryEntry | undefined {
  return registry[getSettingsSectionKey(group, child)]
}

export function getSettingsGroupEntries(
  registry: SettingsSectionRegistry,
  group: SettingsGroupKey,
): SettingsSectionRegistryEntry[] {
  return Object.values(registry).filter((entry) => entry.group === group)
}

export function createSettingsSectionRegistry(domains: SettingsSectionRegistryDomains): SettingsSectionRegistry {
  const {
    advancedDomain,
    aboutDomain,
    connectionDomain,
    historyDomain,
    modelDomain,
    watcherDomain,
  } = domains

  return {
    'connection/bridge': {
      key: 'connection/bridge',
      group: 'connection',
      child: 'bridge',
      cachePolicy: 'keep-alive',
      skeletonKind: 'form',
      loader: () => import('./sections/SettingsConnectionBridgeSection.vue'),
      prepare: (force) => connectionDomain.refreshConnectionState(force),
    },
    'connection/workspace': {
      key: 'connection/workspace',
      group: 'connection',
      child: 'workspace',
      cachePolicy: 'keep-alive',
      skeletonKind: 'dense',
      loader: () => import('./sections/SettingsConnectionWorkspaceSection.vue'),
      prepare: (force) => connectionDomain.refreshConnectionState(force),
    },
    'model/current': {
      key: 'model/current',
      group: 'model',
      child: 'current',
      cachePolicy: 'keep-alive',
      skeletonKind: 'form',
      loader: () => import('./sections/SettingsModelCurrentSection.vue'),
      prepare: (force) => advancedDomain.ensureBaseReady(force),
    },
    'model/library': {
      key: 'model/library',
      group: 'model',
      child: 'library',
      cachePolicy: 'keep-alive',
      skeletonKind: 'list',
      loader: () => import('./sections/SettingsModelLibrarySection.vue'),
      prepare: (force) => modelDomain.ensureLibraryReady(force),
    },
    'history/messages': {
      key: 'history/messages',
      group: 'history',
      child: 'messages',
      cachePolicy: 'discard',
      skeletonKind: 'list',
      loader: () => import('./sections/SettingsHistoryMessagesSection.vue'),
      prepare: (force) => historyDomain.ensureMessagesReady(force),
    },
    'history/statistics': {
      key: 'history/statistics',
      group: 'history',
      child: 'statistics',
      cachePolicy: 'discard',
      skeletonKind: 'dense',
      loader: () => import('./sections/SettingsHistoryStatisticsSection.vue'),
      prepare: (force) => historyDomain.ensureStatisticsReady(force),
    },
    'advanced/behavior': {
      key: 'advanced/behavior',
      group: 'advanced',
      child: 'behavior',
      cachePolicy: 'keep-alive',
      skeletonKind: 'form',
      loader: () => import('./sections/SettingsAdvancedBehaviorSection.vue'),
      prepare: (force) => advancedDomain.ensureBehaviorReady(force),
    },
    'advanced/shortcut': {
      key: 'advanced/shortcut',
      group: 'advanced',
      child: 'shortcut',
      cachePolicy: 'keep-alive',
      skeletonKind: 'form',
      loader: () => import('./sections/SettingsAdvancedShortcutSection.vue'),
      prepare: (force) => advancedDomain.ensureShortcutReady(force),
    },
    'advanced/window-watcher': {
      key: 'advanced/window-watcher',
      group: 'advanced',
      child: 'window-watcher',
      cachePolicy: 'keep-alive',
      skeletonKind: 'form',
      loader: () => import('./sections/SettingsAdvancedWatcherSection.vue'),
      prepare: (force) => watcherDomain.ensureReady(force),
    },
    'advanced/data': {
      key: 'advanced/data',
      group: 'advanced',
      child: 'data',
      cachePolicy: 'discard',
      skeletonKind: 'dense',
      loader: () => import('./sections/SettingsAdvancedDataSection.vue'),
    },
    'about/info': {
      key: 'about/info',
      group: 'about',
      child: 'info',
      cachePolicy: 'discard',
      skeletonKind: 'dense',
      loader: () => import('./sections/SettingsAboutInfoSection.vue'),
      prepare: (force) => aboutDomain.ensureReady(force),
    },
  }
}

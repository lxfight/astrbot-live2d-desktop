<template>
  <div class="settings-window">
    <SettingsTitlebar
      :is-window-maximized="isWindowMaximized"
      @close="handleCloseWindow"
      @minimize="handleMinimizeWindow"
      @titlebar-dblclick="handleTitleBarDoubleClick"
      @toggle-maximize="handleToggleWindowMaximize"
    />

    <div class="settings-workspace">
      <SettingsPrimaryNav
        :active-group="activeGroup"
        @select-group="selectGroup"
      />

      <SettingsSecondaryNav
        :active-child="activeChild"
        :active-group="activeGroup"
        :active-group-label="activeGroupMeta.label"
        :items="activeGroupChildren"
        @select-child="selectChild"
      />

      <main class="settings-content">
        <SettingsSectionSkeleton v-if="!navigationReady" kind="form" />
        <SettingsSectionHost
          v-else
          :active-child="activeChild"
          :active-group="activeGroup"
          :registry="sectionRegistry"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, provide, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import { createSettingsSectionRegistry } from './settings/settingsRegistry'
import { useSettingsNavigation } from './settings/composables/useSettingsNavigation'
import { useSettingsWindowChrome } from './settings/composables/useSettingsWindowChrome'
import SettingsPrimaryNav from './settings/shared/SettingsPrimaryNav.vue'
import SettingsSectionSkeleton from './settings/shared/SettingsSectionSkeleton.vue'
import SettingsSecondaryNav from './settings/shared/SettingsSecondaryNav.vue'
import SettingsSectionHost from './settings/shared/SettingsSectionHost.vue'
import SettingsTitlebar from './settings/shared/SettingsTitlebar.vue'
import {
  connectionSettingsDomainKey,
  createConnectionSettingsDomain,
} from './settings/domains/createConnectionSettingsDomain'
import {
  modelSettingsDomainKey,
  createModelSettingsDomain,
} from './settings/domains/createModelSettingsDomain'
import {
  advancedSettingsDomainKey,
  createAdvancedSettingsDomain,
} from './settings/domains/createAdvancedSettingsDomain'
import {
  watcherSettingsDomainKey,
  createWatcherSettingsDomain,
} from './settings/domains/createWatcherSettingsDomain'
import {
  aboutSettingsDomainKey,
  createAboutSettingsDomain,
} from './settings/domains/createAboutSettingsDomain'
import {
  historySettingsDomainKey,
  createHistorySettingsDomain,
} from './settings/domains/createHistorySettingsDomain'
import {
  maintenanceSettingsDomainKey,
  createMaintenanceSettingsDomain,
} from './settings/domains/createMaintenanceSettingsDomain'
import './settings/settings-shell.scss'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const modelStore = useModelStore()

const {
  activeChild,
  activeGroup,
  activeGroupChildren,
  activeGroupMeta,
  navigateToPage,
  selectChild,
  selectGroup,
} = useSettingsNavigation()
const {
  applyMaximizedChanged,
  handleCloseWindow,
  handleMinimizeWindow,
  handleTitleBarDoubleClick,
  handleToggleWindowMaximize,
  isWindowMaximized,
  loadInitialState,
} = useSettingsWindowChrome(message)

const connectionDomain = createConnectionSettingsDomain(message)
const modelDomain = createModelSettingsDomain(message)
const advancedDomain = createAdvancedSettingsDomain(message)
const watcherDomain = createWatcherSettingsDomain(message)
const aboutDomain = createAboutSettingsDomain(message)
const historyDomain = createHistorySettingsDomain({
  dialog,
  message,
})
const maintenanceDomain = createMaintenanceSettingsDomain({
  aboutDomain,
  advancedDomain,
  connectionDomain,
  dialog,
  message,
  watcherDomain,
})

provide(connectionSettingsDomainKey, connectionDomain)
provide(modelSettingsDomainKey, modelDomain)
provide(advancedSettingsDomainKey, advancedDomain)
provide(watcherSettingsDomainKey, watcherDomain)
provide(aboutSettingsDomainKey, aboutDomain)
provide(historySettingsDomainKey, historyDomain)
provide(maintenanceSettingsDomainKey, maintenanceDomain)

const sectionRegistry = createSettingsSectionRegistry({
  advancedDomain,
  aboutDomain,
  connectionDomain,
  historyDomain,
  modelDomain,
  watcherDomain,
})

const navigationReady = ref(false)
const settingsWindowDisposers: Unsubscribe[] = []

onMounted(async () => {
  await connectionStore.ensureInitialized()
  modelStore.startStorageSync()

  if (window.electron.settings?.onNavigateTo) {
    settingsWindowDisposers.push(window.electron.settings.onNavigateTo((page: string) => {
      navigateToPage(page)
    }))
  }

  const loadInitialStatePromise = loadInitialState()
  if (window.electron.settings?.getPendingPage) {
    const pendingPage = await window.electron.settings.getPendingPage()
    if (pendingPage) {
      navigateToPage(pendingPage)
    }
  }
  navigationReady.value = true
  await loadInitialStatePromise

  settingsWindowDisposers.push(window.electron.update.onStateChanged((state: UpdateState) => {
    aboutDomain.applyUpdateState(state)
  }))

  settingsWindowDisposers.push(window.electron.window.onMaximizedChanged((maximized: boolean) => {
    applyMaximizedChanged(maximized)
  }))

  settingsWindowDisposers.push(window.electron.desktopBehavior.onSnapshotChanged((snapshot: DesktopBehaviorSnapshot) => {
    advancedDomain.applyDesktopFeatureSettingsState(snapshot.preferences)
  }))

  settingsWindowDisposers.push(window.electron.connectionSettings.onChanged(async () => {
    await connectionDomain.handleExternalSettingsChanged()
    await historyDomain.syncResourceConfig(true)
  }))

  settingsWindowDisposers.push(window.electron.connectionBehaviorSettings.onChanged((event) => {
    if (!event?.settings) {
      return
    }
    advancedDomain.applyConnectionBehaviorSettingsState(event.settings)
  }))

  settingsWindowDisposers.push(window.electron.bridgeLifecycle.onStateChanged(() => {
    void historyDomain.syncResourceConfig(true)
  }))

  await nextTick()
  await window.electron.window.notifyRendererReady('settings')
})

onUnmounted(() => {
  modelStore.stopStorageSync()

  for (const dispose of settingsWindowDisposers.splice(0)) {
    dispose()
  }
})
</script>

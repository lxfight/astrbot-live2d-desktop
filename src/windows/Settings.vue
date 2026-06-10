<template>
  <div class="settings-window">
    <SettingsShellTitlebar
      :active-child="activeChild"
      :active-group="activeGroup"
      :is-window-maximized="isWindowMaximized"
      :is-pinned="isPinned"
      @close="handleCloseWindow"
      @minimize="handleMinimizeWindow"
      @open-search="commandPaletteOpen = true"
      @titlebar-dblclick="handleTitleBarDoubleClick"
      @toggle-maximize="handleToggleWindowMaximize"
      @toggle-pin="handleTogglePin"
    />

    <SettingsCommandPalette v-model:show="commandPaletteOpen" @select="selectPage" />

    <div
      class="settings-workspace"
      :class="{ 'settings-workspace--sidebar-collapsed': settingsSidebarCollapsed }"
    >
      <SettingsSidebar
        :active-child="activeChild"
        :active-group="activeGroup"
        @select="selectPage"
      />

      <main class="settings-content" :class="contentLayoutClass">
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
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import { useThemeStore } from '@/stores/theme'
import { createSettingsSectionRegistry, getSettingsSectionEntry } from './settings/settingsRegistry'
import { settingsPageContextKey } from './settings/settingsPageContext'
import { useSettingsNavigation } from './settings/composables/useSettingsNavigation'
import { useSettingsWindowChrome } from './settings/composables/useSettingsWindowChrome'
import SettingsCommandPalette from './settings/shared/SettingsCommandPalette.vue'
import SettingsSidebar from './settings/shared/SettingsSidebar.vue'
import SettingsSectionSkeleton from './settings/shared/SettingsSectionSkeleton.vue'
import SettingsSectionHost from './settings/shared/SettingsSectionHost.vue'
import SettingsShellTitlebar from './settings/shared/SettingsShellTitlebar.vue'
import {
  connectionSettingsDomainKey,
  createConnectionSettingsDomain
} from './settings/domains/createConnectionSettingsDomain'
import {
  modelSettingsDomainKey,
  createModelSettingsDomain
} from './settings/domains/createModelSettingsDomain'
import {
  advancedSettingsDomainKey,
  createAdvancedSettingsDomain
} from './settings/domains/createAdvancedSettingsDomain'
import {
  watcherSettingsDomainKey,
  createWatcherSettingsDomain
} from './settings/domains/createWatcherSettingsDomain'
import {
  aboutSettingsDomainKey,
  createAboutSettingsDomain
} from './settings/domains/createAboutSettingsDomain'
import {
  historySettingsDomainKey,
  createHistorySettingsDomain
} from './settings/domains/createHistorySettingsDomain'
import {
  maintenanceSettingsDomainKey,
  createMaintenanceSettingsDomain
} from './settings/domains/createMaintenanceSettingsDomain'
import './settings/settings-shell.scss'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const modelStore = useModelStore()
const themeStore = useThemeStore()
const appearanceStore = useAppearanceStore()
const { settingsSidebarCollapsed } = storeToRefs(appearanceStore)

const { activeChild, activeGroup, navigateToPage, selectPage } = useSettingsNavigation()

provide(settingsPageContextKey, { activeGroup, activeChild })

const {
  applyMaximizedChanged,
  handleCloseWindow,
  handleMinimizeWindow,
  handleTitleBarDoubleClick,
  handleToggleWindowMaximize,
  isWindowMaximized,
  isPinned,
  handleTogglePin,
  loadInitialState
} = useSettingsWindowChrome(message)

const commandPaletteOpen = ref(false)

const connectionDomain = createConnectionSettingsDomain(message)
const modelDomain = createModelSettingsDomain(message)
const advancedDomain = createAdvancedSettingsDomain(message)
const watcherDomain = createWatcherSettingsDomain(message)
const aboutDomain = createAboutSettingsDomain(message)
const historyDomain = createHistorySettingsDomain({
  dialog,
  message
})
const maintenanceDomain = createMaintenanceSettingsDomain({
  aboutDomain,
  advancedDomain,
  connectionDomain,
  dialog,
  message,
  watcherDomain
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
  watcherDomain
})

const contentLayoutClass = computed(() => {
  const entry = getSettingsSectionEntry(sectionRegistry, activeGroup.value, activeChild.value)
  const profile = entry?.layoutProfile ?? 'document'
  return `settings-content--${profile}`
})

const navigationReady = ref(false)
const settingsWindowDisposers: Unsubscribe[] = []

function onCommandPaletteShortcut(event: KeyboardEvent) {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  const mod = isMac ? event.metaKey : event.ctrlKey
  if (mod && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    commandPaletteOpen.value = true
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onCommandPaletteShortcut)

  await connectionStore.ensureInitialized()
  modelStore.startStorageSync()
  themeStore.startStorageSync()

  if (window.electron.settings?.onNavigateTo) {
    settingsWindowDisposers.push(
      window.electron.settings.onNavigateTo((page: string) => {
        navigateToPage(page)
      })
    )
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

  settingsWindowDisposers.push(
    window.electron.update.onStateChanged((state: UpdateState) => {
      aboutDomain.applyUpdateState(state)
    })
  )

  settingsWindowDisposers.push(
    window.electron.window.onMaximizedChanged((maximized: boolean) => {
      applyMaximizedChanged(maximized)
    })
  )

  settingsWindowDisposers.push(
    window.electron.desktopBehavior.onSnapshotChanged((snapshot: DesktopBehaviorSnapshot) => {
      advancedDomain.applyDesktopFeatureSettingsState(snapshot.preferences)
    })
  )

  settingsWindowDisposers.push(
    window.electron.connectionSettings.onChanged(async () => {
      await connectionDomain.handleExternalSettingsChanged()
      await historyDomain.syncResourceConfig(true)
    })
  )

  settingsWindowDisposers.push(
    window.electron.connectionBehaviorSettings.onChanged(event => {
      if (!event?.settings) {
        return
      }
      advancedDomain.applyConnectionBehaviorSettingsState(event.settings)
    })
  )

  settingsWindowDisposers.push(
    window.electron.bridgeLifecycle.onStateChanged(() => {
      void historyDomain.syncResourceConfig(true)
    })
  )

  await nextTick()
  await window.electron.window.notifyRendererReady('settings')
})

onUnmounted(() => {
  window.removeEventListener('keydown', onCommandPaletteShortcut)
  modelStore.stopStorageSync()
  themeStore.stopStorageSync()

  for (const dispose of settingsWindowDisposers.splice(0)) {
    dispose()
  }
})
</script>

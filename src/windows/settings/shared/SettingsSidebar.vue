<template>
  <aside
    class="settings-sidebar"
    :class="{ 'settings-sidebar--collapsed': collapsed }"
    :aria-label="$t('settings.titlebar.title')"
  >
    <button
      class="settings-sidebar__collapse window-no-drag"
      type="button"
      :aria-label="collapsed ? $t('settings.sidebar.expand') : $t('settings.sidebar.collapse')"
      @click="appearanceStore.toggleSettingsSidebarCollapsed()"
    >
      <PanelLeftClose v-if="!collapsed" :size="16" />
      <PanelLeftOpen v-else :size="16" />
    </button>

    <div class="settings-sidebar__scroll">
      <template v-for="group in menuGroups" :key="group.key">
        <div class="settings-sidebar__group-label">
          {{ $t(`settings.menu.groupLabel.${group.key}`) }}
        </div>
        <button
          v-for="child in group.children"
          :key="child.key"
          class="settings-sidebar__item"
          :class="{
            'settings-sidebar__item--active': activeGroup === group.key && activeChild === child.key
          }"
          type="button"
          @click="selectChild(group.key, child.key)"
        >
          <span class="settings-sidebar__item-icon" aria-hidden="true">
            <component :is="child.icon" :size="18" />
          </span>
          <span class="settings-sidebar__item-label">{{
            $t(`settings.menu.${group.key}.${child.key}`)
          }}</span>
        </button>
      </template>
    </div>

    <footer class="settings-sidebar__foot window-no-drag">
      <span
        class="settings-sidebar__status-dot"
        :class="{ 'settings-sidebar__status-dot--on': isConnected }"
        aria-hidden="true"
      />
      <span class="settings-sidebar__foot-text">
        <template v-if="!collapsed"> {{ connectionStatusText }} · v{{ appVersion }} </template>
        <template v-else>{{ isConnected ? '●' : '○' }}</template>
      </span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import { useConnectionStore } from '@/stores/connection'
import { APP_METADATA } from '@/shared/metadata'
import { useI18n } from 'vue-i18n'
import { settingsMenuGroups, type SettingsChildKey, type SettingsGroupKey } from '../settingsMenu'

defineProps<{
  activeChild: SettingsChildKey
  activeGroup: SettingsGroupKey
}>()

const emit = defineEmits<{
  (event: 'select', group: SettingsGroupKey, child: SettingsChildKey): void
}>()

const appearanceStore = useAppearanceStore()
const { settingsSidebarCollapsed: collapsed } = storeToRefs(appearanceStore)
const connectionStore = useConnectionStore()
const { t } = useI18n()

const menuGroups = settingsMenuGroups
const appVersion = APP_METADATA.version
const isConnected = computed(() => connectionStore.isConnected)

const connectionStatusText = computed(() =>
  isConnected.value ? t('settings.sidebar.connected') : t('settings.sidebar.disconnected')
)

function selectChild(group: SettingsGroupKey, child: SettingsChildKey) {
  emit('select', group, child)
}
</script>

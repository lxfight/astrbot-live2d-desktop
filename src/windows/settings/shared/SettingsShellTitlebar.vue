<template>
  <header
    class="settings-shell-titlebar window-drag-region"
    :class="{ 'settings-shell-titlebar--macos': isMacOS }"
    @dblclick="$emit('titlebar-dblclick')"
  >
    <div class="settings-shell-titlebar__start">
      <h1 class="settings-shell-titlebar__title">{{ $t('settings.titlebar.title') }}</h1>
      <transition name="settings-crumb" mode="out-in">
        <p v-if="breadcrumb" :key="breadcrumb" class="settings-shell-titlebar__crumb">
          {{ breadcrumb }}
        </p>
      </transition>
    </div>

    <div class="settings-shell-titlebar__center window-no-drag">
      <button class="settings-search-pill" type="button" @click="$emit('open-search')">
        <Search :size="14" />
        <span>{{ $t('settings.search.placeholder') }}</span>
        <kbd>{{ searchShortcutLabel }}</kbd>
      </button>
    </div>

    <div class="settings-shell-titlebar__actions window-no-drag">
      <SettingsQuickMenu />
      <button
        class="settings-shell-titlebar__icon-btn"
        :class="{ 'settings-shell-titlebar__icon-btn--active': isPinned }"
        type="button"
        :aria-label="isPinned ? $t('settings.titlebar.unpin') : $t('settings.titlebar.pin')"
        @click="$emit('toggle-pin')"
      >
        <component :is="isPinned ? Pin : PinOff" :size="16" />
      </button>
      <button
        class="settings-shell-titlebar__icon-btn"
        type="button"
        :aria-label="$t('settings.titlebar.minimize')"
        @click="$emit('minimize')"
      >
        <Minus :size="16" />
      </button>
      <button
        class="settings-shell-titlebar__icon-btn"
        type="button"
        :aria-label="
          isWindowMaximized ? $t('settings.titlebar.restore') : $t('settings.titlebar.maximize')
        "
        @click="$emit('toggle-maximize')"
      >
        <component :is="isWindowMaximized ? Copy : Square" :size="14" />
      </button>
      <button
        class="settings-shell-titlebar__icon-btn settings-shell-titlebar__icon-btn--close"
        type="button"
        :aria-label="$t('settings.titlebar.close')"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Minus, Pin, PinOff, Search, Square, X } from 'lucide-vue-next'
import SettingsQuickMenu from './SettingsQuickMenu.vue'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'

const props = defineProps<{
  activeChild: SettingsChildKey
  activeGroup: SettingsGroupKey
  isPinned: boolean
  isWindowMaximized: boolean
}>()

defineEmits<{
  (event: 'close'): void
  (event: 'minimize'): void
  (event: 'open-search'): void
  (event: 'titlebar-dblclick'): void
  (event: 'toggle-maximize'): void
  (event: 'toggle-pin'): void
}>()

const { t } = useI18n()
const isMacOS = navigator.platform.toLowerCase().includes('mac')

const breadcrumb = computed(() => {
  const group = t(`settings.menu.${props.activeGroup}`)
  const child = t(`settings.menu.${props.activeGroup}.${props.activeChild}`)
  return `${group} › ${child}`
})

const searchShortcutLabel = computed(() => (isMacOS ? '⌘K' : 'Ctrl+K'))
</script>

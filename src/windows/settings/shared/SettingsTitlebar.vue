<template>
  <header
    class="settings-titlebar window-drag-region"
    :class="{ 'settings-titlebar--macos': isMacOS }"
    @dblclick="$emit('titlebar-dblclick')"
  >
    <div class="settings-titlebar__brand">
      <span class="settings-titlebar__view">{{ $t('settings.titlebar.title') }}</span>
    </div>

    <div class="settings-titlebar__actions window-no-drag">
      <button
        class="settings-titlebar__button"
        :class="{ 'settings-titlebar__button--active': isPinned }"
        type="button"
        :aria-label="isPinned ? $t('settings.titlebar.unpin') : $t('settings.titlebar.pin')"
        @click="$emit('toggle-pin')"
      >
        <component :is="isPinned ? Pin : PinOff" :size="16" />
      </button>
      <button
        class="settings-titlebar__button"
        type="button"
        :aria-label="$t('settings.titlebar.minimize')"
        @click="$emit('minimize')"
      >
        <Minus :size="16" />
      </button>
      <button
        class="settings-titlebar__button"
        type="button"
        :aria-label="
          isWindowMaximized ? $t('settings.titlebar.restore') : $t('settings.titlebar.maximize')
        "
        @click="$emit('toggle-maximize')"
      >
        <component :is="isWindowMaximized ? Copy : Square" :size="14" />
      </button>
      <button
        class="settings-titlebar__button settings-titlebar__button--close"
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
import { Copy, Minus, Pin, PinOff, Square, X } from 'lucide-vue-next'

defineProps<{
  isWindowMaximized: boolean
  isPinned: boolean
}>()

const isMacOS = navigator.platform.toLowerCase().includes('mac')

defineEmits<{
  (event: 'close'): void
  (event: 'minimize'): void
  (event: 'titlebar-dblclick'): void
  (event: 'toggle-maximize'): void
  (event: 'toggle-pin'): void
}>()
</script>

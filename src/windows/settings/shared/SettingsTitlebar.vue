<template>
  <header class="settings-titlebar window-drag-region" @dblclick="$emit('titlebar-dblclick')">
    <div class="settings-titlebar__brand">
      <span class="settings-titlebar__view">{{ $t('settings.titlebar.title') }}</span>
    </div>

    <div class="settings-titlebar__actions window-no-drag">
      <button class="settings-titlebar__button" type="button" :aria-label="$t('settings.titlebar.minimize')" @click="$emit('minimize')">
        <Minus :size="16" />
      </button>
      <button
        class="settings-titlebar__button"
        type="button"
        :aria-label="isWindowMaximized ? $t('settings.titlebar.restore') : $t('settings.titlebar.maximize')"
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
import { Copy, Minus, Square, X } from 'lucide-vue-next'

defineProps<{
  isWindowMaximized: boolean
}>()

defineEmits<{
  (event: 'close'): void
  (event: 'minimize'): void
  (event: 'titlebar-dblclick'): void
  (event: 'toggle-maximize'): void
}>()
</script>

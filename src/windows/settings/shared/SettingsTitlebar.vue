<template>
  <header class="settings-titlebar window-drag-region" @dblclick="$emit('titlebar-dblclick')">
    <div class="settings-titlebar__brand">
      <span class="settings-titlebar__view">设置</span>
    </div>

    <div class="settings-titlebar__actions window-no-drag">
      <button class="settings-titlebar__button" type="button" aria-label="最小化" @click="$emit('minimize')">
        <Minus :size="16" />
      </button>
      <button
        class="settings-titlebar__button"
        type="button"
        :aria-label="isWindowMaximized ? '还原' : '最大化'"
        @click="$emit('toggle-maximize')"
      >
        <component :is="isWindowMaximized ? Copy : Square" :size="14" />
      </button>
      <button
        class="settings-titlebar__button settings-titlebar__button--close"
        type="button"
        aria-label="关闭"
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

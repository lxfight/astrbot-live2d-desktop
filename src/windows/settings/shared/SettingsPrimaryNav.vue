<template>
  <nav class="settings-primary-nav">
    <n-tooltip
      v-for="group in menuGroups"
      :key="group.key"
      placement="right"
      :show-arrow="false"
      trigger="hover"
    >
      <template #trigger>
        <button
          class="settings-primary-nav__item"
          :class="{ 'settings-primary-nav__item--active': activeGroup === group.key }"
          type="button"
          @click="$emit('select-group', group.key)"
        >
          <component :is="group.icon" :size="20" />
        </button>
      </template>
      {{ group.label }}
    </n-tooltip>
  </nav>
</template>

<script setup lang="ts">
import { settingsMenuGroups, type SettingsGroupKey } from '../settingsMenu'

defineProps<{
  activeGroup: SettingsGroupKey
}>()

defineEmits<{
  (event: 'select-group', group: SettingsGroupKey): void
}>()

const menuGroups = settingsMenuGroups
</script>

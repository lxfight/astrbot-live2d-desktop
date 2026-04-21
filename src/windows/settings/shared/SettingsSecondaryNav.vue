<template>
  <aside class="settings-secondary-nav">
    <transition name="slide-fade" mode="out-in">
      <div class="settings-secondary-nav__header" :key="activeGroup">
        <strong>{{ activeGroupLabel }}</strong>
      </div>
    </transition>

    <transition name="list-fade" mode="out-in">
      <div class="settings-secondary-nav__list" :key="activeGroup">
        <button
          v-for="item in items"
          :key="item.key"
          class="settings-secondary-nav__item"
          :class="{ 'settings-secondary-nav__item--active': activeChild === item.key }"
          type="button"
          @click="$emit('select-child', item.key)"
        >
          <span>{{ item.label }}</span>
        </button>
      </div>
    </transition>
  </aside>
</template>

<script setup lang="ts">
import type { SettingsChildKey, SettingsGroupKey, SettingsMenuChild } from '../settingsMenu'

defineProps<{
  activeChild: SettingsChildKey
  activeGroup: SettingsGroupKey
  activeGroupLabel: string
  items: SettingsMenuChild[]
}>()

defineEmits<{
  (event: 'select-child', child: SettingsChildKey): void
}>()
</script>

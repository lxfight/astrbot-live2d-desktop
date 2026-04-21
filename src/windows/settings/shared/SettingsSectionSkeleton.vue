<template>
  <div class="settings-content__viewport settings-content__viewport--pending">
    <section class="settings-section">
      <div class="settings-section__header settings-section__header--pending">
        <n-skeleton text width="28%" />
        <n-skeleton text width="16%" />
      </div>

      <p class="settings-section__desc">
        <n-skeleton text :repeat="2" />
      </p>

      <div v-if="kind === 'list'" class="settings-skeleton-grid">
        <div v-for="index in 6" :key="index" class="settings-skeleton-card">
          <n-skeleton text width="45%" />
          <n-skeleton text :repeat="2" />
          <div class="settings-skeleton-card__actions">
            <n-skeleton text width="30%" />
            <n-skeleton text width="26%" />
          </div>
        </div>
      </div>

      <div v-else-if="kind === 'dense'" class="settings-skeleton-stack">
        <n-skeleton v-for="index in 6" :key="index" text :repeat="2" />
      </div>

      <div v-else class="settings-skeleton-stack">
        <n-skeleton v-for="index in 5" :key="index" text :repeat="3" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { SettingsSectionSkeletonKind } from '../settingsRegistry'

withDefaults(defineProps<{
  kind?: SettingsSectionSkeletonKind
}>(), {
  kind: 'form',
})
</script>

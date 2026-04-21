<template>
  <div class="settings-content__viewport">
    <SettingsSectionSkeleton v-if="loadState === 'loading'" :kind="activeEntry?.skeletonKind" />

    <section v-else-if="loadState === 'error'" class="settings-section">
      <div class="settings-section__header">
        <h2>分区加载失败</h2>
      </div>
      <p class="settings-section__desc">{{ errorMessage }}</p>
      <div class="settings-section__actions">
        <n-button type="primary" @click="retry">重试</n-button>
      </div>
    </section>

    <KeepAlive>
      <component
        :is="activeComponent"
        v-if="loadState === 'ready' && activeComponent && shouldKeepAlive"
        :key="activeSectionKey"
      />
    </KeepAlive>

    <component
      :is="activeComponent"
      v-if="loadState === 'ready' && activeComponent && !shouldKeepAlive"
      :key="discardRenderKey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'
import type { SettingsSectionRegistry } from '../settingsRegistry'
import { useSettingsSectionHost } from '../composables/useSettingsSectionHost'
import SettingsSectionSkeleton from './SettingsSectionSkeleton.vue'

const props = defineProps<{
  activeChild: SettingsChildKey
  activeGroup: SettingsGroupKey
  registry: SettingsSectionRegistry
}>()

const {
  activeComponent,
  activeEntry,
  activeSectionKey,
  discardRenderKey,
  errorMessage,
  loadState,
  retry,
} = useSettingsSectionHost({
  activeChild: toRef(props, 'activeChild'),
  activeGroup: toRef(props, 'activeGroup'),
  registry: toRef(props, 'registry'),
})

const shouldKeepAlive = computed(() => activeEntry.value?.cachePolicy === 'keep-alive')
</script>

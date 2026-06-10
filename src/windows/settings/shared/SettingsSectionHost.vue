<template>
  <div
    class="settings-content__viewport"
    :class="[
      viewportLayoutClass,
      {
        'settings-content__viewport--pending': loadState === 'loading',
        'settings-content-stagger': loadState === 'ready'
      }
    ]"
  >
    <SettingsSectionSkeleton v-if="loadState === 'loading'" :kind="activeEntry?.skeletonKind" />

    <section v-else-if="loadState === 'error'" class="settings-section">
      <div class="settings-section__header">
        <h2>{{ $t('settings.section.loadFailed') }}</h2>
      </div>
      <p class="settings-section__desc">{{ errorMessage }}</p>
      <div class="settings-section__actions">
        <n-button type="primary" @click="retry">{{ $t('settings.section.retry') }}</n-button>
      </div>
    </section>

    <transition v-else name="settings-section" mode="out-in">
      <KeepAlive v-if="loadState === 'ready' && activeComponent && shouldKeepAlive">
        <component :is="activeComponent" :key="activeSectionKey" />
      </KeepAlive>
      <component
        :is="activeComponent"
        v-else-if="loadState === 'ready' && activeComponent && !shouldKeepAlive"
        :key="discardRenderKey"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'
import type { SettingsLayoutProfile, SettingsSectionRegistry } from '../settingsRegistry'
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
  retry
} = useSettingsSectionHost({
  activeChild: toRef(props, 'activeChild'),
  activeGroup: toRef(props, 'activeGroup'),
  registry: toRef(props, 'registry')
})

const shouldKeepAlive = computed(() => activeEntry.value?.cachePolicy === 'keep-alive')

const layoutProfile = computed<SettingsLayoutProfile>(
  () => activeEntry.value?.layoutProfile ?? 'document'
)

const viewportLayoutClass = computed(() => {
  switch (layoutProfile.value) {
    case 'workspace':
      return 'settings-content__viewport--workspace'
    case 'master-detail':
      return 'settings-content__viewport--master-detail'
    case 'dashboard':
      return 'settings-content__viewport--dashboard'
    case 'immersive':
      return 'settings-content__viewport--immersive'
    default:
      return 'settings-content__viewport--document'
  }
})
</script>

<template>
  <div class="settings-page settings-content-stagger">
    <SettingsPageHeader
      v-if="showHeader"
      :page-key="pageKey"
      :title="title"
      :description="description"
      :immersive="immersive"
    >
      <template v-if="$slots.headerExtra" #extra>
        <slot name="headerExtra" />
      </template>
    </SettingsPageHeader>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import SettingsPageHeader from './SettingsPageHeader.vue'
import { useSettingsPageMeta } from '../composables/useSettingsPageMeta'
import { settingsPageContextKey } from '../settingsPageContext'

const props = withDefaults(
  defineProps<{
    showHeader?: boolean
    immersive?: boolean
  }>(),
  {
    showHeader: true,
    immersive: false
  }
)

const context = inject(settingsPageContextKey)
if (!context) {
  throw new Error('SettingsPageScaffold 需要在 Settings 窗口内使用')
}

const { pageKey, title, description } = useSettingsPageMeta(
  context.activeGroup,
  context.activeChild
)

const showHeader = computed(() => props.showHeader && !props.immersive)
</script>

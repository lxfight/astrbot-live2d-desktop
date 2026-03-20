<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="naiveThemeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-theme-root">
          <router-view />
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { cssVars, naiveThemeOverrides } = storeToRefs(themeStore)

onMounted(() => {
  themeStore.syncFromStorage()
})

watchEffect(() => {
  if (typeof document === 'undefined') {
    return
  }

  const rootStyle = document.documentElement.style
  Object.entries(cssVars.value).forEach(([key, value]) => {
    rootStyle.setProperty(key, value)
  })
})
</script>

<style scoped>
.app-theme-root {
  width: 100%;
  height: 100%;
}
</style>

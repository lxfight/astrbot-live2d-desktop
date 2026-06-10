<template>
  <n-dropdown
    trigger="click"
    placement="bottom-end"
    :expand-trigger="expandTrigger"
    :options="menuOptions"
    @select="handleSelect"
  >
    <button
      class="settings-shell-titlebar__icon-btn settings-shell-titlebar__menu-trigger"
      type="button"
      :aria-label="$t('settings.quickMenu.title')"
    >
      <MoreHorizontal :size="18" />
    </button>
  </n-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreHorizontal } from 'lucide-vue-next'
import type { DropdownOption } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useAppearanceStore, type ColorSchemePreference } from '@/stores/appearance'
import { useLocaleStore } from '@/stores/locale'

const { t } = useI18n()
const localeStore = useLocaleStore()
const appearanceStore = useAppearanceStore()
const { colorSchemePreference } = storeToRefs(appearanceStore)

/** 一级只显示两项；子项在二级子菜单里 */
const expandTrigger = 'hover' as const

const check = (on: boolean) => (on ? ' ✓' : '')

const menuOptions = computed<DropdownOption[]>(() => [
  {
    key: 'lang-menu',
    label: t('settings.about.language'),
    children: [
      {
        key: 'lang:zh-CN',
        label: `中文${check(localeStore.locale === 'zh-CN')}`
      },
      {
        key: 'lang:en',
        label: `English${check(localeStore.locale === 'en')}`
      }
    ]
  },
  {
    key: 'theme-menu',
    label: t('settings.appearance.colorScheme'),
    children: [
      {
        key: 'theme:light',
        label: `${t('settings.appearance.colorScheme.light')}${check(colorSchemePreference.value === 'light')}`
      },
      {
        key: 'theme:dark',
        label: `${t('settings.appearance.colorScheme.dark')}${check(colorSchemePreference.value === 'dark')}`
      },
      {
        key: 'theme:system',
        label: `${t('settings.appearance.colorScheme.system')}${check(colorSchemePreference.value === 'system')}`
      }
    ]
  }
])

function handleSelect(key: string) {
  if (key === 'lang-menu' || key === 'theme-menu') {
    return
  }
  if (key.startsWith('lang:')) {
    const loc = key.slice(5)
    if (loc === 'zh-CN' || loc === 'en') {
      localeStore.setLocale(loc)
      void window.electron.locale.set(loc)
    }
    return
  }
  if (key.startsWith('theme:')) {
    appearanceStore.setColorSchemePreference(key.slice(6) as ColorSchemePreference)
  }
}
</script>

<style scoped>
.settings-shell-titlebar__menu-trigger {
  margin-right: 4px;
}
</style>

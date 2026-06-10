import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'

export function useSettingsPageMeta(group: Ref<SettingsGroupKey>, child: Ref<SettingsChildKey>) {
  const { t, te } = useI18n()

  const pageKey = computed(() => `${group.value}/${child.value}`)

  const title = computed(() => t(`settings.menu.${group.value}.${child.value}`))

  const description = computed(() => {
    const key = `settings.page.${group.value}.${child.value}.desc`
    return te(key) ? t(key) : ''
  })

  return { pageKey, title, description }
}

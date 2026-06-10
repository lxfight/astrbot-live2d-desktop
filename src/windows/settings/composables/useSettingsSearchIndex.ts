import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { settingsMenuGroups, type SettingsChildKey, type SettingsGroupKey } from '../settingsMenu'

export interface SettingsSearchItem {
  id: string
  group: SettingsGroupKey
  child: SettingsChildKey
  title: string
  keywords: string
}

export function useSettingsSearchIndex() {
  const { t } = useI18n()

  const items = computed<SettingsSearchItem[]>(() => {
    const result: SettingsSearchItem[] = []

    for (const group of settingsMenuGroups) {
      for (const child of group.children) {
        const title = t(`settings.menu.${group.key}.${child.key}`)
        const descKey = `settings.page.${group.key}.${child.key}.desc`
        const desc = t(descKey)
        const groupLabel = t(`settings.menu.groupLabel.${group.key}`)

        result.push({
          id: `${group.key}/${child.key}`,
          group: group.key,
          child: child.key,
          title,
          keywords: `${title} ${groupLabel} ${desc} ${group.key} ${child.key}`.toLowerCase()
        })
      }
    }

    return result
  })

  function filterItems(query: string): SettingsSearchItem[] {
    const q = query.trim().toLowerCase()
    if (!q) {
      return items.value
    }

    return items.value.filter(
      item => item.keywords.includes(q) || item.title.toLowerCase().includes(q)
    )
  }

  return { items, filterItems }
}

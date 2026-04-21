import { computed, ref } from 'vue'
import {
  findSettingsMenuGroup,
  settingsMenuGroups,
  type SettingsChildKey,
  type SettingsGroupKey,
} from '../settingsMenu'

export function useSettingsNavigation() {
  const activeGroup = ref<SettingsGroupKey>('connection')
  const activeChild = ref<SettingsChildKey>('bridge')

  const activeGroupMeta = computed(() => {
    return findSettingsMenuGroup(activeGroup.value) ?? settingsMenuGroups[0]
  })

  const activeGroupChildren = computed(() => activeGroupMeta.value.children)
  const activeSectionKey = computed(() => `${activeGroup.value}/${activeChild.value}`)

  function navigateToPage(page: string) {
    const [groupPart, childPart] = page.split('/')
    const group = groupPart as SettingsGroupKey
    const child = childPart as SettingsChildKey | undefined

    const groupMeta = findSettingsMenuGroup(group)
    if (!groupMeta) {
      return
    }

    activeGroup.value = group
    if (child && groupMeta.children.some((item) => item.key === child)) {
      activeChild.value = child
      return
    }

    activeChild.value = groupMeta.children[0]?.key ?? activeChild.value
  }

  function selectGroup(group: SettingsGroupKey) {
    const groupMeta = findSettingsMenuGroup(group)
    if (!groupMeta) {
      return
    }

    activeGroup.value = group
    activeChild.value = groupMeta.children[0]?.key ?? activeChild.value
  }

  function selectChild(child: SettingsChildKey) {
    if (!activeGroupChildren.value.some((item) => item.key === child)) {
      return
    }

    activeChild.value = child
  }

  return {
    activeGroup,
    activeChild,
    activeGroupMeta,
    activeGroupChildren,
    activeSectionKey,
    navigateToPage,
    selectGroup,
    selectChild,
  }
}

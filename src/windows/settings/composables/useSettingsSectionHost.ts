import { computed, markRaw, ref, shallowRef, watch, type Component, type Ref } from 'vue'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'
import {
  getSettingsGroupEntries,
  getSettingsSectionEntry,
  getSettingsSectionKey,
  type SettingsSectionRegistry,
  type SettingsSectionRegistryEntry,
} from '../settingsRegistry'

interface UseSettingsSectionHostOptions {
  activeChild: Ref<SettingsChildKey>
  activeGroup: Ref<SettingsGroupKey>
  registry: Ref<SettingsSectionRegistry>
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error) {
    return error
  }

  return '未知错误'
}

export function useSettingsSectionHost(options: UseSettingsSectionHostOptions) {
  const { activeChild, activeGroup, registry } = options

  const activeEntry = computed(() => {
    return getSettingsSectionEntry(registry.value, activeGroup.value, activeChild.value)
  })
  const activeSectionKey = computed(() => getSettingsSectionKey(activeGroup.value, activeChild.value))

  const activeComponent = shallowRef<Component | null>(null)
  const loadState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const errorMessage = ref('分区尚未准备好')
  const discardRenderKey = ref(0)

  const cachedComponents = new Map<string, Component>()
  const warmedGroups = new Set<SettingsGroupKey>()
  let activationToken = 0

  async function resolveComponent(entry: SettingsSectionRegistryEntry): Promise<Component> {
    if (entry.cachePolicy === 'keep-alive') {
      const cached = cachedComponents.get(entry.key)
      if (cached) {
        return cached
      }
    }

    const module = await entry.loader()
    const component = markRaw(module.default)

    if (entry.cachePolicy === 'keep-alive') {
      cachedComponents.set(entry.key, component)
    }

    return component
  }

  function prewarmGroup(group: SettingsGroupKey, currentKey: string) {
    if (warmedGroups.has(group)) {
      return
    }

    warmedGroups.add(group)
    for (const entry of getSettingsGroupEntries(registry.value, group)) {
      if (entry.key === currentKey || entry.cachePolicy !== 'keep-alive') {
        continue
      }

      void resolveComponent(entry)
    }
  }

  async function activate(entry: SettingsSectionRegistryEntry | undefined, force = false) {
    const currentToken = ++activationToken

    if (!entry) {
      activeComponent.value = null
      loadState.value = 'error'
      errorMessage.value = '未找到对应设置分区'
      return
    }

    loadState.value = 'loading'
    errorMessage.value = ''

    try {
      const [component] = await Promise.all([
        resolveComponent(entry),
        entry.prepare?.(force) ?? Promise.resolve(),
      ])

      if (currentToken !== activationToken) {
        return
      }

      activeComponent.value = component
      if (entry.cachePolicy === 'discard') {
        discardRenderKey.value += 1
      }
      loadState.value = 'ready'
      prewarmGroup(entry.group, entry.key)
    } catch (error) {
      if (currentToken !== activationToken) {
        return
      }

      activeComponent.value = null
      loadState.value = 'error'
      errorMessage.value = normalizeErrorMessage(error)
    }
  }

  function retry() {
    void activate(activeEntry.value, true)
  }

  watch(activeSectionKey, () => {
    void activate(activeEntry.value)
  }, { immediate: true })

  return {
    activeComponent,
    activeEntry,
    activeSectionKey,
    discardRenderKey,
    errorMessage,
    loadState,
    retry,
  }
}

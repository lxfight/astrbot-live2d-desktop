import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  buildNaiveThemeOverrides,
  buildThemeCssVars,
  createThemePalette,
  hexToRgb,
  type ThemeRgb,
} from '@/utils/themePalette'

const THEME_STORAGE_KEY = 'rendererThemeState'
const DEFAULT_THEME_HEX = '#74a5ff'

type ThemePersistedState = {
  currentModelPath: string
  currentModelName: string
  sourceColor: string
}

function getModelNameFromPath(modelPath: string): string {
  return modelPath.split(/[/\\]/).filter(Boolean).pop() || 'AstrBot Live2D'
}

function readPersistedTheme(): ThemePersistedState {
  if (typeof window === 'undefined') {
    return {
      currentModelPath: '',
      currentModelName: '',
      sourceColor: DEFAULT_THEME_HEX,
    }
  }

  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) {
      return {
        currentModelPath: localStorage.getItem('lastModelPath') || '',
        currentModelName: '',
        sourceColor: DEFAULT_THEME_HEX,
      }
    }

    const parsed = JSON.parse(raw) as Partial<ThemePersistedState>
    return {
      currentModelPath: typeof parsed.currentModelPath === 'string' ? parsed.currentModelPath : '',
      currentModelName: typeof parsed.currentModelName === 'string' ? parsed.currentModelName : '',
      sourceColor: typeof parsed.sourceColor === 'string' ? parsed.sourceColor : DEFAULT_THEME_HEX,
    }
  } catch (error) {
    console.warn('[ThemeStore] 读取主题配置失败，使用默认值:', error)
    return {
      currentModelPath: localStorage.getItem('lastModelPath') || '',
      currentModelName: '',
      sourceColor: DEFAULT_THEME_HEX,
    }
  }
}

export const useThemeStore = defineStore('theme', () => {
  const persisted = readPersistedTheme()
  const currentModelPath = ref(persisted.currentModelPath)
  const currentModelName = ref(persisted.currentModelName || getModelNameFromPath(persisted.currentModelPath))
  const sourceColor = ref(persisted.sourceColor)

  const palette = computed(() => createThemePalette(hexToRgb(sourceColor.value)))
  const cssVars = computed(() => buildThemeCssVars(palette.value, resolvedModelName.value))
  const naiveThemeOverrides = computed(() => buildNaiveThemeOverrides(palette.value))
  const resolvedModelName = computed(() => currentModelName.value || getModelNameFromPath(currentModelPath.value))
  const sourceRgb = computed(() => hexToRgb(sourceColor.value))

  function persistState() {
    if (typeof window === 'undefined') {
      return
    }

    const payload: ThemePersistedState = {
      currentModelPath: currentModelPath.value,
      currentModelName: currentModelName.value,
      sourceColor: sourceColor.value,
    }

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload))
  }

  function syncFromStorage() {
    const next = readPersistedTheme()
    currentModelPath.value = next.currentModelPath
    currentModelName.value = next.currentModelName || getModelNameFromPath(next.currentModelPath)
    sourceColor.value = next.sourceColor
  }

  function setCurrentModel(modelPath: string, modelName?: string) {
    currentModelPath.value = modelPath
    currentModelName.value = modelName || getModelNameFromPath(modelPath)
    persistState()
  }

  function applyModelTheme(payload: { modelPath: string; modelName?: string; rgb: ThemeRgb }) {
    currentModelPath.value = payload.modelPath
    currentModelName.value = payload.modelName || getModelNameFromPath(payload.modelPath)
    sourceColor.value = `#${[payload.rgb.r, payload.rgb.g, payload.rgb.b]
      .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
      .join('')}`
    persistState()
  }

  function setModelName(modelName: string) {
    currentModelName.value = modelName || getModelNameFromPath(currentModelPath.value)
    persistState()
  }

  function onThemeStorageChange(event: StorageEvent) {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY && event.key !== 'lastModelPath') {
      return
    }

    syncFromStorage()
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', onThemeStorageChange)
    window.addEventListener('storage', onThemeStorageChange)
  }

  return {
    currentModelPath,
    currentModelName,
    resolvedModelName,
    sourceColor,
    sourceRgb,
    palette,
    cssVars,
    naiveThemeOverrides,
    syncFromStorage,
    setCurrentModel,
    setModelName,
    applyModelTheme,
  }
})

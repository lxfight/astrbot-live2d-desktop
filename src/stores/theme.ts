import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  buildNaiveThemeOverrides,
  buildThemeCssVars,
  createThemePalette,
  hexToRgb,
  type ThemeRgb,
} from '@/utils/themePalette'
import { rgbToHexString } from '@/utils/color'
import { LOCAL_STORAGE_METADATA } from '@/shared/metadata'
import { readJsonStorage, writeJsonStorage } from '@/utils/storage'

const THEME_STORAGE_KEY = LOCAL_STORAGE_METADATA.themeState.key
const DEFAULT_THEME_HEX = '#74a5ff'
const THEME_STORAGE_VERSION = LOCAL_STORAGE_METADATA.themeState.version
const LAST_MODEL_PATH_KEY = LOCAL_STORAGE_METADATA.lastModelPath.key

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
    return readJsonStorage(THEME_STORAGE_KEY, {
        fallback: {
        currentModelPath: localStorage.getItem(LAST_MODEL_PATH_KEY) || '',
        currentModelName: '',
        sourceColor: DEFAULT_THEME_HEX,
      },
      normalize: (value) => {
        const parsed = value && typeof value === 'object'
          ? value as Partial<ThemePersistedState>
          : {}

        return {
          currentModelPath: typeof parsed.currentModelPath === 'string' ? parsed.currentModelPath : '',
          currentModelName: typeof parsed.currentModelName === 'string' ? parsed.currentModelName : '',
          sourceColor: typeof parsed.sourceColor === 'string' ? parsed.sourceColor : DEFAULT_THEME_HEX,
        }
      },
      version: THEME_STORAGE_VERSION,
    })
  } catch (error) {
    console.warn('[ThemeStore] 读取主题配置失败，使用默认值:', error)
    return {
      currentModelPath: localStorage.getItem(LAST_MODEL_PATH_KEY) || '',
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

    writeJsonStorage(THEME_STORAGE_KEY, payload, { version: THEME_STORAGE_VERSION })
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
    sourceColor.value = rgbToHexString(payload.rgb)
    persistState()
  }

  function setModelName(modelName: string) {
    currentModelName.value = modelName || getModelNameFromPath(currentModelPath.value)
    persistState()
  }

  function onThemeStorageChange(event: StorageEvent) {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY && event.key !== LAST_MODEL_PATH_KEY) {
      return
    }

    syncFromStorage()
  }

  function startStorageSync() {
    if (storageSyncBound || typeof window === 'undefined') {
      return
    }

    window.addEventListener('storage', onThemeStorageChange)
    storageSyncBound = true
  }

  function stopStorageSync() {
    if (!storageSyncBound || typeof window === 'undefined') {
      return
    }

    window.removeEventListener('storage', onThemeStorageChange)
    storageSyncBound = false
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
    startStorageSync,
    stopStorageSync,
    setCurrentModel,
    setModelName,
    applyModelTheme,
  }
})
  let storageSyncBound = false

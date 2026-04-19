import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LOCAL_STORAGE_METADATA } from '@/shared/metadata'
import { readJsonStorage, writeJsonStorage } from '@/utils/storage'

const MODEL_POSITIONS_KEY = LOCAL_STORAGE_METADATA.modelPositions.key
const MODEL_POSITIONS_VERSION = LOCAL_STORAGE_METADATA.modelPositions.version
const MODEL_POSITION_WRITE_DELAY_MS = 200
const MODEL_SCALES_KEY = LOCAL_STORAGE_METADATA.modelScales.key
const MODEL_SCALES_VERSION = LOCAL_STORAGE_METADATA.modelScales.version
const MODEL_SCALE_WRITE_DELAY_MS = 200
const LAST_MODEL_PATH_KEY = LOCAL_STORAGE_METADATA.lastModelPath.key

export const useModelStore = defineStore('model', () => {
  const currentModel = ref<string>('')
  const availableModels = ref<Array<{ name: string; path: string }>>([])
  const modelPositions = ref<Record<string, { x: number; y: number }>>(
    readJsonStorage(MODEL_POSITIONS_KEY, {
      fallback: {},
      normalize: (value) => (value && typeof value === 'object' ? value as Record<string, { x: number; y: number }> : {}),
      version: MODEL_POSITIONS_VERSION,
    })
  )
  const modelScales = ref<Record<string, number>>(
    readJsonStorage(MODEL_SCALES_KEY, {
      fallback: {},
      normalize: (value) => (value && typeof value === 'object' ? value as Record<string, number> : {}),
      version: MODEL_SCALES_VERSION,
    })
  )
  let positionPersistTimer: number | null = null
  let scalePersistTimer: number | null = null

  function persistModelPositions() {
    writeJsonStorage(MODEL_POSITIONS_KEY, modelPositions.value, { version: MODEL_POSITIONS_VERSION })
  }

  function scheduleModelPositionsPersist() {
    if (positionPersistTimer !== null) {
      clearTimeout(positionPersistTimer)
    }

    positionPersistTimer = window.setTimeout(() => {
      persistModelPositions()
      positionPersistTimer = null
    }, MODEL_POSITION_WRITE_DELAY_MS)
  }

  function persistModelScales() {
    writeJsonStorage(MODEL_SCALES_KEY, modelScales.value, { version: MODEL_SCALES_VERSION })
  }

  function scheduleModelScalesPersist() {
    if (scalePersistTimer !== null) {
      clearTimeout(scalePersistTimer)
    }

    scalePersistTimer = window.setTimeout(() => {
      persistModelScales()
      scalePersistTimer = null
    }, MODEL_SCALE_WRITE_DELAY_MS)
  }

  function setCurrentModel(path: string) {
    currentModel.value = path
    if (path) {
      localStorage.setItem(LAST_MODEL_PATH_KEY, path)
    }
  }

  function getLastModel(): string | null {
    return localStorage.getItem(LAST_MODEL_PATH_KEY)
  }

  function setModelPosition(x: number, y: number) {
    // 为当前模型保存位置
    if (currentModel.value) {
      modelPositions.value[currentModel.value] = { x, y }
      scheduleModelPositionsPersist()
    }
  }

  function getModelPosition(modelPath?: string): { x: number; y: number } | null {
    const path = modelPath || currentModel.value
    if (!path) return null

    return modelPositions.value[path] || null
  }

  function setModelScale(scale: number, modelPath?: string) {
    const path = modelPath || currentModel.value
    if (path) {
      modelScales.value[path] = scale
      scheduleModelScalesPersist()
    }
  }

  function getModelScale(modelPath?: string): number {
    const path = modelPath || currentModel.value
    if (!path) return 1.0

    return modelScales.value[path] || 1.0
  }

  function getAllModelPositions(): Record<string, { x: number; y: number }> {
    return { ...modelPositions.value }
  }

  async function loadModelList() {
    const result = await window.electron.model.getList()
    if (result.success && result.models) {
      availableModels.value = result.models
    }
  }

  return {
    currentModel,
    availableModels,
    setCurrentModel,
    getLastModel,
    setModelPosition,
    getModelPosition,
    getAllModelPositions,
    setModelScale,
    getModelScale,
    loadModelList
  }
})

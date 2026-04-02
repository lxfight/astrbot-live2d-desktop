import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readJsonStorage, writeJsonStorage } from '@/utils/storage'

const MODEL_POSITIONS_KEY = 'modelPositions'
const MODEL_POSITIONS_VERSION = 1
const MODEL_POSITION_WRITE_DELAY_MS = 200

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
  let positionPersistTimer: number | null = null

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

  function setCurrentModel(path: string) {
    currentModel.value = path
    // 保存到 localStorage
    if (path) {
      localStorage.setItem('lastModelPath', path)
    }
  }

  function getLastModel(): string | null {
    return localStorage.getItem('lastModelPath')
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
    loadModelList
  }
})

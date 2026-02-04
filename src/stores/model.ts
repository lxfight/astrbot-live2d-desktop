import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useModelStore = defineStore('model', () => {
  const currentModel = ref<string>('')
  const availableModels = ref<Array<{ name: string; path: string }>>([])

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
      const positions = getAllModelPositions()
      positions[currentModel.value] = { x, y }
      localStorage.setItem('modelPositions', JSON.stringify(positions))
    }
  }

  function getModelPosition(modelPath?: string): { x: number; y: number } | null {
    const path = modelPath || currentModel.value
    if (!path) return null

    const positions = getAllModelPositions()
    return positions[path] || null
  }

  function getAllModelPositions(): Record<string, { x: number; y: number }> {
    const saved = localStorage.getItem('modelPositions')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {}
      }
    }
    return {}
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
    loadModelList
  }
})

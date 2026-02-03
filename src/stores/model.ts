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
    localStorage.setItem('modelPosition', JSON.stringify({ x, y }))
  }

  function getModelPosition(): { x: number; y: number } | null {
    const saved = localStorage.getItem('modelPosition')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    return null
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

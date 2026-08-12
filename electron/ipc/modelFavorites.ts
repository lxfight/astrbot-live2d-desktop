import { ipcMain } from 'electron'
import {
  addModelFavorite,
  removeModelFavorite,
  isModelFavorited,
  getAllModelFavorites,
  updateModelFavorite,
  addModelTag,
  removeModelTag,
  getModelTags,
  getAllTags,
  searchModelsByTag,
  type ModelFavorite
} from '../database/schema'

ipcMain.handle(
  'modelFavorites:add',
  async (_event, modelPath: string, displayName?: string, notes?: string) => {
    try {
      addModelFavorite(modelPath, displayName, notes)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
)

ipcMain.handle('modelFavorites:remove', async (_event, modelPath: string) => {
  try {
    removeModelFavorite(modelPath)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:isFavorited', async (_event, modelPath: string) => {
  try {
    const favorited = isModelFavorited(modelPath)
    return { success: true, favorited }
  } catch (error) {
    return {
      success: false,
      favorited: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:getAll', async () => {
  try {
    const favorites = getAllModelFavorites()
    return { success: true, favorites }
  } catch (error) {
    return {
      success: false,
      favorites: [] as ModelFavorite[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle(
  'modelFavorites:update',
  async (_event, modelPath: string, displayName?: string, notes?: string) => {
    try {
      updateModelFavorite(modelPath, displayName, notes)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
)

ipcMain.handle('modelFavorites:addTag', async (_event, modelPath: string, tag: string) => {
  try {
    addModelTag(modelPath, tag)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:removeTag', async (_event, modelPath: string, tag: string) => {
  try {
    removeModelTag(modelPath, tag)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:getTags', async (_event, modelPath: string) => {
  try {
    const tags = getModelTags(modelPath)
    return { success: true, tags }
  } catch (error) {
    return {
      success: false,
      tags: [] as string[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:getAllTags', async () => {
  try {
    const tags = getAllTags()
    return { success: true, tags }
  } catch (error) {
    return {
      success: false,
      tags: [] as string[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelFavorites:searchByTag', async (_event, tag: string) => {
  try {
    const modelPaths = searchModelsByTag(tag)
    return { success: true, modelPaths }
  } catch (error) {
    return {
      success: false,
      modelPaths: [] as string[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

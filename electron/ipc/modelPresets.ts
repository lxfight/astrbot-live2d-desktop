import { ipcMain } from 'electron'
import {
  saveModelPreset,
  getAllModelPresets,
  getModelPresets,
  getModelPreset,
  deleteModelPreset,
  updateModelPresetNotes,
  type ModelPreset
} from '../database/schema'

ipcMain.handle(
  'modelPresets:save',
  async (
    _event,
    presetName: string,
    modelPath: string,
    idleActivity: number,
    persistentExpressions: string[],
    scale?: number,
    positionX?: number,
    positionY?: number,
    notes?: string
  ) => {
    try {
      saveModelPreset(
        presetName,
        modelPath,
        idleActivity,
        persistentExpressions,
        scale,
        positionX,
        positionY,
        notes
      )
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
)

ipcMain.handle('modelPresets:getAll', async () => {
  try {
    const presets = getAllModelPresets()
    return { success: true, presets }
  } catch (error) {
    return {
      success: false,
      presets: [] as ModelPreset[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelPresets:getByModel', async (_event, modelPath: string) => {
  try {
    const presets = getModelPresets(modelPath)
    return { success: true, presets }
  } catch (error) {
    return {
      success: false,
      presets: [] as ModelPreset[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelPresets:get', async (_event, presetName: string) => {
  try {
    const preset = getModelPreset(presetName)
    return { success: true, preset }
  } catch (error) {
    return {
      success: false,
      preset: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelPresets:delete', async (_event, presetName: string) => {
  try {
    deleteModelPreset(presetName)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('modelPresets:updateNotes', async (_event, presetName: string, notes: string) => {
  try {
    updateModelPresetNotes(presetName, notes)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

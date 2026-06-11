import { ipcMain } from 'electron'
import { unlink } from 'fs/promises'
import { createScopedLogger } from '../utils/logger'
import {
  readModelConfigFile,
  writeModelConfigFile,
  getModelConfigPath
} from '../utils/modelConfigPaths'
import type { ModelAliasConfigV2 } from '../../src/shared/modelConfigFactory'

const logger = createScopedLogger('ipc.modelConfig')

export function registerModelConfigHandlers() {
  ipcMain.handle('modelConfig:load', async (_event, modelPath: string) => {
    try {
      const config = await readModelConfigFile(modelPath)
      if (!config) {
        logger.debug('config.notFound', { modelPath })
        return { success: false, config: null }
      }
      logger.info('config.loaded', { modelPath })
      return { success: true, config }
    } catch (error: any) {
      logger.error('config.loadFailed', { modelPath, error: error.message })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('modelConfig:save', async (_event, config: ModelAliasConfigV2) => {
    try {
      const configPath = await writeModelConfigFile(config)
      logger.info('config.saved', { modelPath: config.modelPath, configPath })
      return { success: true }
    } catch (error: any) {
      logger.error('config.saveFailed', { modelPath: config.modelPath, error: error.message })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('modelConfig:delete', async (_event, modelPath: string) => {
    try {
      const configPath = getModelConfigPath(modelPath)
      await unlink(configPath)
      logger.info('config.deleted', { modelPath, configPath })
      return { success: true }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { success: true }
      }
      logger.error('config.deleteFailed', { modelPath, error: error.message })
      return { success: false, error: error.message }
    }
  })
}

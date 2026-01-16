/**
 * Live2D 模型管理服务
 * 封装模型的加载、导入、删除等操作
 */

import { ElectronService } from './base'
import { AppError, ErrorCode } from '@/utils/errorHandler'
import { logger } from '@/utils/logger'

export interface ModelManifest {
  models: ModelInfo[]
}

export interface ModelInfo {
  name: string
  path: string
  id?: string
  thumbnail?: string
  description?: string
  isDeletable?: boolean
}

export class ModelService extends ElectronService {
  /**
   * 获取模型清单
   */
  async getModelManifest(): Promise<ModelManifest> {
    try {
      const response = await fetch('/models/manifest.json')
      if (!response.ok) {
        throw new AppError({
          code: ErrorCode.MODEL_NOT_FOUND,
          message: 'Model manifest not found'
        })
      }
      return await response.json()
    } catch (error) {
      logger.error('获取模型清单失败', error)
      throw new AppError({
        code: ErrorCode.MODEL_LOAD_FAILED,
        message: 'Failed to load model manifest',
        originalError: error
      })
    }
  }

  /**
   * 获取所有可用模型
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    if (this.isElectron && window.electronAPI?.getAvailableModels) {
      const result = await this.callIPC(
        'getAvailableModels',
        () => window.electronAPI!.getAvailableModels(),
        '获取模型列表失败'
      )

      if (result.success && result.models) {
        return result.models
      }
    }

    const manifest = await this.getModelManifest()
    return manifest.models || []
  }

  /**
   * 根据ID获取模型信息
   */
  async getModelById(id: string): Promise<ModelInfo | null> {
    const models = await this.getAvailableModels()
    return models.find(m => m.id === id || m.name === id) || null
  }

  /**
   * 导入新模型（仅 Electron）
   */
  async importModel(
    sourcePath: string,
    targetName: string
  ): Promise<{ success: boolean; modelPath?: string; error?: string }> {
    return this.callIPC(
      'importModel',
      () => window.electronAPI!.importModel(sourcePath, targetName),
      '导入模型失败'
    )
  }

  /**
   * 删除模型（仅 Electron）
   */
  async deleteModel(modelId: string): Promise<{ success: boolean; error?: string }> {
    return this.callIPC(
      'deleteModel',
      () => window.electronAPI!.deleteModel(modelId),
      '删除模型失败'
    )
  }

  /**
   * 获取模型列表（仅 Electron）
   */
  async getModelList(): Promise<ModelInfo[]> {
    return this.getAvailableModels()
  }

  /**
   * 验证模型文件完整性
   */
  async validateModel(modelPath: string): Promise<boolean> {
    try {
      const response = await fetch(modelPath)
      if (!response.ok) {
        logger.warn(`模型验证失败: ${modelPath}`, response.status)
        return false
      }
      const data = await response.json()
      // 简单验证：检查是否包含基本字段
      return !!(data.Version && data.FileReferences)
    } catch (error) {
      logger.error(`模型验证异常: ${modelPath}`, error)
      return false
    }
  }
}

// 导出单例
export const modelService = new ModelService()

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
  id: string
  name: string
  path: string
  thumbnail?: string
  description?: string
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
    const manifest = await this.getModelManifest()
    return manifest.models || []
  }

  /**
   * 根据ID获取模型信息
   */
  async getModelById(id: string): Promise<ModelInfo | null> {
    const models = await this.getAvailableModels()
    return models.find(m => m.id === id) || null
  }

  /**
   * 导入新模型（仅 Electron）
   */
  async importModel(): Promise<string | null> {
    return this.callIPC(
      'importModel',
      () => window.electronAPI!.importModel(),
      '导入模型失败'
    )
  }

  /**
   * 删除模型（仅 Electron）
   */
  async deleteModel(modelId: string): Promise<void> {
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
    if (!this.isElectron) {
      // 浏览器模式下从 manifest 获取
      return this.getAvailableModels()
    }
    return this.callIPC(
      'getModelList',
      () => window.electronAPI!.getModelList(),
      '获取模型列表失败'
    )
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

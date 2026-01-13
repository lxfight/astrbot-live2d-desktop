/**
 * Electron IPC 服务基类
 * 提供统一的 IPC 调用和错误处理
 */

import { AppError, ErrorCode, handleError } from '@/utils/errorHandler'
import { logger } from '@/utils/logger'

export class ElectronService {
  protected isElectron: boolean

  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI
  }

  protected checkElectronAPI(): void {
    if (!this.isElectron || !window.electronAPI) {
      throw new AppError({
        code: ErrorCode.IPC_NOT_AVAILABLE,
        message: 'Electron API is not available. Running in browser mode?'
      })
    }
  }

  protected async callIPC<T>(
    method: string,
    handler: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    try {
      this.checkElectronAPI()
      logger.debug(`IPC调用: ${method}`)
      const result = await handler()
      logger.debug(`IPC调用成功: ${method}`, result)
      return result
    } catch (error) {
      const appError = new AppError({
        code: ErrorCode.IPC_CALL_FAILED,
        message: errorMessage || `IPC call failed: ${method}`,
        originalError: error,
        context: { method }
      })
      handleError(appError, 'ElectronService')
      throw appError
    }
  }
}

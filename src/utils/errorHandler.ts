/**
 * 统一错误处理工具
 * 提供错误分类、格式化和处理
 */

import { logger } from './logger'

export enum ErrorCode {
  // 通用错误
  UNKNOWN = 'UNKNOWN',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',

  // WebSocket 错误
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  WS_AUTH_FAILED = 'WS_AUTH_FAILED',
  WS_MESSAGE_INVALID = 'WS_MESSAGE_INVALID',

  // Live2D 错误
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_INVALID = 'MODEL_INVALID',

  // Electron IPC 错误
  IPC_CALL_FAILED = 'IPC_CALL_FAILED',
  IPC_NOT_AVAILABLE = 'IPC_NOT_AVAILABLE',

  // 数据库错误
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',

  // 文件系统错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_FAILED = 'FILE_READ_FAILED',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',

  // 配置错误
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING'
}

export interface AppErrorOptions {
  code: ErrorCode
  message: string
  originalError?: Error | unknown
  context?: Record<string, any>
  userMessage?: string
}

export class AppError extends Error {
  code: ErrorCode
  originalError?: Error | unknown
  context?: Record<string, any>
  userMessage?: string
  timestamp: Date

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.code = options.code
    this.originalError = options.originalError
    this.context = options.context
    this.userMessage = options.userMessage || this.getDefaultUserMessage(options.code)
    this.timestamp = new Date()

    // 保持原始错误堆栈
    if (options.originalError instanceof Error) {
      this.stack = options.originalError.stack
    }
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.UNKNOWN]: '发生了未知错误',
      [ErrorCode.NETWORK]: '网络连接失败，请检查网络设置',
      [ErrorCode.TIMEOUT]: '操作超时，请重试',
      [ErrorCode.WS_CONNECTION_FAILED]: 'WebSocket 连接失败，请检查服务地址',
      [ErrorCode.WS_AUTH_FAILED]: 'WebSocket 认证失败，请检查 Token',
      [ErrorCode.WS_MESSAGE_INVALID]: '收到无效的消息格式',
      [ErrorCode.MODEL_LOAD_FAILED]: 'Live2D 模型加载失败',
      [ErrorCode.MODEL_NOT_FOUND]: '找不到 Live2D 模型文件',
      [ErrorCode.MODEL_INVALID]: 'Live2D 模型格式无效',
      [ErrorCode.IPC_CALL_FAILED]: 'IPC 调用失败',
      [ErrorCode.IPC_NOT_AVAILABLE]: 'Electron API 不可用（可能在浏览器模式下）',
      [ErrorCode.DB_QUERY_FAILED]: '数据库查询失败',
      [ErrorCode.DB_CONNECTION_FAILED]: '数据库连接失败',
      [ErrorCode.FILE_NOT_FOUND]: '文件未找到',
      [ErrorCode.FILE_READ_FAILED]: '文件读取失败',
      [ErrorCode.FILE_WRITE_FAILED]: '文件写入失败',
      [ErrorCode.CONFIG_INVALID]: '配置格式无效',
      [ErrorCode.CONFIG_MISSING]: '缺少必要的配置'
    }
    return messages[code] || messages[ErrorCode.UNKNOWN]
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString()
    }
  }
}

// 错误处理函数
export function handleError(error: unknown, context?: string): AppError {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    appError = new AppError({
      code: ErrorCode.UNKNOWN,
      message: error.message,
      originalError: error,
      context: context ? { location: context } : undefined
    })
  } else {
    appError = new AppError({
      code: ErrorCode.UNKNOWN,
      message: String(error),
      originalError: error,
      context: context ? { location: context } : undefined
    })
  }

  // 记录错误日志
  logger.error(
    `${context ? `[${context}] ` : ''}${appError.code}: ${appError.message}`,
    appError.originalError,
    appError.context
  )

  return appError
}

// 异步操作错误包装
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode,
  context?: string
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw new AppError({
      code: errorCode,
      message: error instanceof Error ? error.message : String(error),
      originalError: error,
      context: context ? { location: context } : undefined
    })
  }
}

// 同步操作错误包装
export function tryCatchSync<T>(
  fn: () => T,
  errorCode: ErrorCode,
  context?: string
): T {
  try {
    return fn()
  } catch (error) {
    throw new AppError({
      code: errorCode,
      message: error instanceof Error ? error.message : String(error),
      originalError: error,
      context: context ? { location: context } : undefined
    })
  }
}

// 显示用户友好的错误提示
export function showErrorToUser(error: unknown): void {
  const appError = error instanceof AppError ? error : handleError(error)

  // 在 Electron 环境中使用对话框
  if (window.electronAPI?.showErrorDialog) {
    window.electronAPI.showErrorDialog({
      title: '错误',
      message: appError.userMessage || appError.message,
      detail: appError.message
    })
  } else {
    // 在浏览器环境中使用 alert
    alert(appError.userMessage || appError.message)
  }
}

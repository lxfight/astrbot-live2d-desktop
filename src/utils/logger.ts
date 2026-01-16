/**
 * 统一日志工具
 * 提供带标签和时间戳的日志输出
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LoggerConfig {
  prefix?: string
  level?: LogLevel
  enableTimestamp?: boolean
  enableConsole?: boolean
}

export class Logger {
  private prefix: string
  private level: LogLevel
  private enableTimestamp: boolean
  private enableConsole: boolean

  constructor(config: LoggerConfig = {}) {
    this.prefix = config.prefix || 'AstrBot-L2D'
    this.level = config.level ?? LogLevel.INFO
    this.enableTimestamp = config.enableTimestamp ?? true
    this.enableConsole = config.enableConsole ?? true
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : ''
    const parts = [timestamp, `[${this.prefix}]`, `[${level}]`, message].filter(Boolean)
    return parts.join(' ')
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enableConsole && level >= this.level
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message), ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message), ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...args)
    }
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message), error, ...args)
    }
  }

  group(label: string): void {
    if (this.enableConsole) {
      console.group(this.formatMessage('GROUP', label))
    }
  }

  groupEnd(): void {
    if (this.enableConsole) {
      console.groupEnd()
    }
  }

  table(data: any): void {
    if (this.enableConsole) {
      console.table(data)
    }
  }

  time(label: string): void {
    if (this.enableConsole) {
      console.time(`[${this.prefix}] ${label}`)
    }
  }

  timeEnd(label: string): void {
    if (this.enableConsole) {
      console.timeEnd(`[${this.prefix}] ${label}`)
    }
  }
}

// 默认导出全局 Logger 实例
export const logger = new Logger({
  prefix: 'AstrBot-L2D',
  level: import.meta.env.VITE_DEBUG_MODE === 'true' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: import.meta.env.VITE_ENABLE_CONSOLE_LOG !== 'false'
})

// 创建子 Logger 的工具函数
export function createLogger(prefix: string, config?: Omit<LoggerConfig, 'prefix'>): Logger {
  return new Logger({ ...config, prefix })
}

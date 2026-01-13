/**
 * Logger 工具单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Logger, LogLevel, createLogger } from '@/utils/logger'

describe('Logger', () => {
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }
  })

  it('should create logger with default config', () => {
    const logger = new Logger()
    expect(logger).toBeDefined()
  })

  it('should log info messages', () => {
    const logger = new Logger({ level: LogLevel.INFO })
    logger.info('Test message')
    expect(consoleSpy.info).toHaveBeenCalled()
  })

  it('should not log debug when level is INFO', () => {
    const logger = new Logger({ level: LogLevel.INFO })
    logger.debug('Test debug')
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  it('should log error messages with error object', () => {
    const logger = new Logger()
    const error = new Error('Test error')
    logger.error('Error occurred', error)
    expect(consoleSpy.error).toHaveBeenCalled()
  })

  it('should create logger with custom prefix', () => {
    const logger = createLogger('Custom')
    logger.info('Test')
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('[Custom]'),
      expect.anything()
    )
  })

  it('should respect enableConsole flag', () => {
    const logger = new Logger({ enableConsole: false })
    logger.info('Test')
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })
})

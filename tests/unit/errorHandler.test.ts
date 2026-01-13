/**
 * 错误处理工具单元测试
 */

import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode, handleError, tryCatch, tryCatchSync } from '@/utils/errorHandler'

describe('AppError', () => {
  it('should create AppError with code and message', () => {
    const error = new AppError({
      code: ErrorCode.NETWORK,
      message: 'Network failed'
    })

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe(ErrorCode.NETWORK)
    expect(error.message).toBe('Network failed')
    expect(error.userMessage).toBeTruthy()
  })

  it('should preserve original error', () => {
    const originalError = new Error('Original')
    const appError = new AppError({
      code: ErrorCode.UNKNOWN,
      message: 'Wrapped error',
      originalError
    })

    expect(appError.originalError).toBe(originalError)
  })

  it('should include context data', () => {
    const appError = new AppError({
      code: ErrorCode.MODEL_LOAD_FAILED,
      message: 'Failed to load',
      context: { modelId: 'test-model' }
    })

    expect(appError.context).toEqual({ modelId: 'test-model' })
  })

  it('should convert to JSON', () => {
    const error = new AppError({
      code: ErrorCode.WS_CONNECTION_FAILED,
      message: 'Connection failed'
    })

    const json = error.toJSON()
    expect(json).toHaveProperty('code')
    expect(json).toHaveProperty('message')
    expect(json).toHaveProperty('timestamp')
  })
})

describe('handleError', () => {
  it('should handle AppError', () => {
    const error = new AppError({
      code: ErrorCode.NETWORK,
      message: 'Test'
    })

    const handled = handleError(error)
    expect(handled).toBe(error)
  })

  it('should wrap normal Error', () => {
    const error = new Error('Normal error')
    const handled = handleError(error)

    expect(handled).toBeInstanceOf(AppError)
    expect(handled.code).toBe(ErrorCode.UNKNOWN)
    expect(handled.originalError).toBe(error)
  })

  it('should handle non-Error values', () => {
    const handled = handleError('String error')

    expect(handled).toBeInstanceOf(AppError)
    expect(handled.message).toBe('String error')
  })
})

describe('tryCatch', () => {
  it('should return value on success', async () => {
    const result = await tryCatch(
      async () => 42,
      ErrorCode.UNKNOWN
    )

    expect(result).toBe(42)
  })

  it('should throw AppError on failure', async () => {
    await expect(
      tryCatch(
        async () => { throw new Error('Failed') },
        ErrorCode.NETWORK
      )
    ).rejects.toThrow(AppError)
  })
})

describe('tryCatchSync', () => {
  it('should return value on success', () => {
    const result = tryCatchSync(
      () => 'success',
      ErrorCode.UNKNOWN
    )

    expect(result).toBe('success')
  })

  it('should throw AppError on failure', () => {
    expect(() => {
      tryCatchSync(
        () => { throw new Error('Failed') },
        ErrorCode.FILE_READ_FAILED
      )
    }).toThrow(AppError)
  })
})

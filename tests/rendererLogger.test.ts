/**
 * rendererLogger 测试
 * 覆盖 console 补丁的转发、幂等性、错误/未处理拒绝捕获
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { setupRendererLogging } from '../src/utils/rendererLogger'

type ForwardedCall = { level: string; args: unknown[] }

function createLoggerForwarder() {
  const calls: ForwardedCall[] = []
  return {
    calls,
    forwarder: {
      debug: vi.fn((...args: unknown[]) => calls.push({ level: 'debug', args })),
      info: vi.fn((...args: unknown[]) => calls.push({ level: 'info', args })),
      warn: vi.fn((...args: unknown[]) => calls.push({ level: 'warn', args })),
      error: vi.fn((...args: unknown[]) => calls.push({ level: 'error', args }))
    }
  }
}

function createWindowMock(forwarder: ReturnType<typeof createLoggerForwarder>['forwarder']) {
  const listeners: Array<{ event: string; handler: (event: unknown) => void }> = []
  return {
    listeners,
    window: {
      electron: { log: forwarder },
      addEventListener: vi.fn((event: string, handler: (event: unknown) => void) => {
        listeners.push({ event, handler })
      })
    }
  }
}

describe('setupRendererLogging', () => {
  const originalDebug = console.debug
  const originalLog = console.log
  const originalInfo = console.info
  const originalWarn = console.warn
  const originalError = console.error

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    console.debug = originalDebug
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
    vi.unstubAllGlobals()
  })

  test('无 electron.log 时补丁仍应用但转发静默跳过，console 调用不抛错', () => {
    vi.stubGlobal('window', { electron: undefined, addEventListener: vi.fn() })
    setupRendererLogging()

    expect(console.debug).not.toBe(originalDebug)
    expect(() => console.debug('no-forwarder')).not.toThrow()
  })

  test('console 输出转发到主进程日志且保留原行为', () => {
    const { calls, forwarder } = createLoggerForwarder()
    const { window } = createWindowMock(forwarder)
    vi.stubGlobal('window', window)

    setupRendererLogging()

    console.debug('debug-message')
    console.log('log-message')
    console.warn('warn-message')
    console.error('error-message')

    const ourCalls = calls.filter(
      call => !JSON.stringify(call.args).includes('[日志] 渲染进程日志已启用')
    )
    expect(ourCalls.map(call => call.level)).toEqual(['debug', 'info', 'warn', 'error'])
    expect(ourCalls.find(call => call.level === 'debug')?.args).toEqual(['debug-message'])
  })

  test('补丁只应用一次（幂等）', () => {
    const { forwarder } = createLoggerForwarder()
    const { window } = createWindowMock(forwarder)
    vi.stubGlobal('window', window)

    setupRendererLogging()
    const patchedLog = console.log
    setupRendererLogging()

    expect(console.log).toBe(patchedLog)
    expect(window.addEventListener).toHaveBeenCalledTimes(2)
  })

  test('捕获 error 事件并按级别转发', () => {
    const { calls, forwarder } = createLoggerForwarder()
    const { listeners, window } = createWindowMock(forwarder)
    vi.stubGlobal('window', window)

    setupRendererLogging()

    const errorListener = listeners.find(entry => entry.event === 'error')
    expect(errorListener).toBeDefined()
    errorListener?.handler({ error: new Error('boom') })

    const errorCall = calls.find(call => call.level === 'error')
    expect(errorCall).toBeDefined()
    expect(JSON.stringify(errorCall?.args)).toContain('boom')
  })

  test('捕获 unhandledrejection 事件并转发 Error 堆栈', () => {
    const { calls, forwarder } = createLoggerForwarder()
    const { listeners, window } = createWindowMock(forwarder)
    vi.stubGlobal('window', window)

    setupRendererLogging()

    const rejectionListener = listeners.find(entry => entry.event === 'unhandledrejection')
    expect(rejectionListener).toBeDefined()
    rejectionListener?.handler({ reason: new Error('rejected-promise') })

    const errorCall = calls.find(call => call.level === 'error')
    expect(JSON.stringify(errorCall?.args)).toContain('rejected-promise')
  })

  test('error 事件无 error 对象时回退到 message 字段', () => {
    const { calls, forwarder } = createLoggerForwarder()
    const { listeners, window } = createWindowMock(forwarder)
    vi.stubGlobal('window', window)

    setupRendererLogging()

    const errorListener = listeners.find(entry => entry.event === 'error')
    errorListener?.handler({ message: 'bare-message' })

    const errorCall = calls.find(call => call.level === 'error')
    expect(JSON.stringify(errorCall?.args)).toContain('bare-message')
  })
})

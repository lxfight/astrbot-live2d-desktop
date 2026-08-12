/**
 * BridgeConnectionController 测试
 * mock 设置服务 / 日志 / 协议客户端，验证连接状态机的关键路径
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ConnectionSettingsPersistedV3 } from '../src/shared/connectionSettings'
import type { ConnectionBehaviorSettingsPersistedV1 } from '../src/shared/connectionBehaviorSettings'

interface FakeClientHandle {
  openOptions: Record<string, unknown> | null
  closed: boolean
  ready: boolean
  emit: (event: string, ...args: unknown[]) => boolean
  setReady: (ready: boolean) => void
}

const harness = vi.hoisted(() => ({
  clients: [] as FakeClientHandle[],
  // 为 null 时 open 默认成功；否则按队列依次决定每次 open 的结果
  openResults: [] as Array<'success' | Error>,
  settingsLoad: {
    success: true as boolean,
    data: null as ConnectionSettingsPersistedV3 | null
  },
  behaviorRecord: {
    exists: true as boolean,
    settings: null as ConnectionBehaviorSettingsPersistedV1 | null
  }
}))

vi.mock('../electron/utils/logger', () => {
  const noop = () => {}
  return {
    createScopedLogger: () => ({
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      timer: () => ({ done: noop, fail: noop })
    })
  }
})

vi.mock('../electron/services/connectionSettingsService', () => ({
  loadConnectionSettings: () =>
    harness.settingsLoad.success
      ? { success: true, data: { ...harness.settingsLoad.data } }
      : { success: false, code: 'STORE_READ_FAILED', message: 'mock failure' },
  buildDefaultConnectionSettingsSnapshot: (): ConnectionSettingsPersistedV3 => ({
    serverUrl: '',
    token: '',
    customResourceBaseUrl: '',
    customResourcePath: '',
    customResourceToken: '',
    revision: 0,
    updatedAt: 0
  })
}))

vi.mock('../electron/services/connectionBehaviorSettingsService', () => ({
  loadConnectionBehaviorSettingsRecord: () => ({
    exists: harness.behaviorRecord.exists,
    settings: { ...harness.behaviorRecord.settings }
  })
}))

vi.mock('../electron/protocol/client', async () => {
  const { EventEmitter } = await import('node:events')

  class FakeBridgeClient extends EventEmitter implements FakeClientHandle {
    openOptions: Record<string, unknown> | null = null
    closed = false
    ready = false

    constructor() {
      super()
      harness.clients.push(this)
    }

    async open(options: Record<string, unknown>): Promise<unknown> {
      this.openOptions = options
      const onSocketOpen = options.onSocketOpen as (() => void) | undefined
      onSocketOpen?.()

      const result = harness.openResults.shift() ?? 'success'
      if (result instanceof Error) {
        throw result
      }

      this.ready = true
      return {
        sessionId: `session-${harness.clients.indexOf(this) + 1}`,
        userId: 'user-1',
        config: {}
      }
    }

    close(): void {
      this.closed = true
      this.ready = false
    }

    isReady(): boolean {
      return this.ready
    }

    setReady(ready: boolean): void {
      this.ready = ready
    }

    sendMessage = vi.fn(async () => [])
    sendTouch = vi.fn()
    sendState = vi.fn()
  }

  return { L2DBridgeClient: FakeBridgeClient }
})

const { BridgeConnectionController } = await import('../electron/bridge/BridgeConnectionController')

function buildSettings(
  overrides: Partial<ConnectionSettingsPersistedV3> = {}
): ConnectionSettingsPersistedV3 {
  return {
    serverUrl: 'ws://127.0.0.1:9238',
    token: 'token-1',
    customResourceBaseUrl: '',
    customResourcePath: '',
    customResourceToken: '',
    revision: 1,
    updatedAt: 1000,
    ...overrides
  }
}

function buildBehavior(
  overrides: Partial<ConnectionBehaviorSettingsPersistedV1> = {}
): ConnectionBehaviorSettingsPersistedV1 {
  return {
    autoConnectOnAppLaunch: false,
    resumeDesiredConnectionOnWake: true,
    retryEnabled: true,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    retryMaxAttempts: null,
    handshakeTimeoutMs: 8000,
    ...overrides
  }
}

describe('BridgeConnectionController', () => {
  let controller: InstanceType<typeof BridgeConnectionController>

  beforeEach(() => {
    vi.useFakeTimers()
    harness.clients.length = 0
    harness.openResults.length = 0
    harness.settingsLoad.success = true
    harness.settingsLoad.data = buildSettings()
    harness.behaviorRecord.exists = true
    harness.behaviorRecord.settings = buildBehavior()
    controller = new BridgeConnectionController()
  })

  afterEach(() => {
    controller.dispose()
    vi.useRealTimers()
  })

  test('connect 成功后进入 connected 并写入会话', async () => {
    await controller.initialize()
    const result = await controller.connect()

    expect(result.success).toBe(true)
    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('connected')
    expect(snapshot.desiredState).toBe('connected')
    expect(snapshot.session?.sessionId).toBe('session-1')
    expect(snapshot.reconnectAttempt).toBe(0)
    expect(snapshot.lastError).toBeNull()
    expect(controller.isConnected()).toBe(true)
  })

  test('connect 前会先校验端点，无效配置不创建客户端', async () => {
    harness.settingsLoad.data = buildSettings({ serverUrl: '' })
    await controller.initialize()

    const result = await controller.connect()

    expect(result.success).toBe(false)
    expect(result.code).toBeDefined()
    expect(harness.clients.length).toBe(0)
    expect(controller.getSnapshot().status).toBe('idle')
  })

  test('connect 失败且可重试时进入 waiting_retry 并按退避调度', async () => {
    harness.openResults.push(new Error('ECONNREFUSED'))
    await controller.initialize()

    const result = await controller.connect()

    expect(result.success).toBe(false)
    expect(result.code).toBe('WS_CONNECT_FAILED')

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('waiting_retry')
    expect(snapshot.reconnectAttempt).toBe(1)
    expect(snapshot.nextRetryAt).not.toBeNull()
    expect(snapshot.lastError?.retryable).toBe(true)

    // 第 1 次重试延迟 = retryBaseDelayMs * 2^0 = 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.clients.length).toBe(2)
    expect(controller.getSnapshot().status).toBe('connected')
    expect(controller.getSnapshot().reconnectAttempt).toBe(0)
  })

  test('连续失败的重试延迟按指数退避增长', async () => {
    harness.openResults.push(new Error('fail-1'), new Error('fail-2'))
    await controller.initialize()
    await controller.connect()

    expect(controller.getSnapshot().reconnectAttempt).toBe(1)

    await vi.advanceTimersByTimeAsync(1000)
    const snapshot = controller.getSnapshot()
    expect(snapshot.reconnectAttempt).toBe(2)
    expect(snapshot.status).toBe('waiting_retry')

    // 第 2 次重试延迟 = 1000 * 2^1 = 2000ms，提前 1ms 不应触发
    await vi.advanceTimersByTimeAsync(1999)
    expect(harness.clients.length).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.clients.length).toBe(3)
  })

  test('达到最大重试次数后停在 error 状态', async () => {
    harness.behaviorRecord.settings = buildBehavior({ retryMaxAttempts: 1 })
    harness.openResults.push(new Error('fail-1'), new Error('fail-2'))
    controller = new BridgeConnectionController()
    await controller.initialize()

    await controller.connect()
    expect(controller.getSnapshot().status).toBe('waiting_retry')

    await vi.advanceTimersByTimeAsync(1000)
    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.nextRetryAt).toBeNull()
    expect(harness.clients.length).toBe(2)
  })

  test('retryEnabled 关闭时失败直接进入 error，不调度重试', async () => {
    harness.behaviorRecord.settings = buildBehavior({ retryEnabled: false })
    harness.openResults.push(new Error('fail-1'))
    controller = new BridgeConnectionController()
    await controller.initialize()

    await controller.connect()

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.nextRetryAt).toBeNull()

    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)
  })

  test('disconnect 关闭客户端并将期望状态置为 disconnected', async () => {
    await controller.initialize()
    await controller.connect()

    const result = await controller.disconnect()

    expect(result.success).toBe(true)
    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.desiredState).toBe('disconnected')
    expect(snapshot.session).toBeNull()
    expect(snapshot.lastDisconnect?.source).toBe('manual')
    expect(harness.clients[0].closed).toBe(true)
  })

  test('活动连接异常断开后自动调度重连', async () => {
    await controller.initialize()
    await controller.connect()
    const client = harness.clients[0]

    client.setReady(false)
    client.emit('disconnected', { code: 1006, reason: 'abnormal closure' })

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('waiting_retry')
    expect(snapshot.desiredState).toBe('connected')
    expect(snapshot.lastDisconnect?.source).toBe('socket-close')
    expect(snapshot.lastError?.code).toBe('WS_UNEXPECTED_CLOSE')

    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.clients.length).toBe(2)
    expect(controller.getSnapshot().status).toBe('connected')
  })

  test('断开后 waiting_retry 期间手动 disconnect 取消重试', async () => {
    await controller.initialize()
    await controller.connect()
    harness.clients[0].setReady(false)
    harness.clients[0].emit('disconnected', { code: 1006, reason: 'closed' })
    expect(controller.getSnapshot().status).toBe('waiting_retry')

    await controller.disconnect()

    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)
    expect(controller.getSnapshot().status).toBe('idle')
  })

  test('传输层设置变更且期望连接时重建连接', async () => {
    await controller.initialize()
    await controller.connect()
    const firstClient = harness.clients[0]

    await controller.handleConnectionSettingsUpdated(
      buildSettings({ serverUrl: 'ws://127.0.0.1:9999', revision: 2 })
    )

    expect(firstClient.closed).toBe(true)
    expect(harness.clients.length).toBe(2)
    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('connected')
    expect(snapshot.serverUrl).toBe('ws://127.0.0.1:9999')
    expect(snapshot.activeConfigRevision).toBe(2)
  })

  test('非传输层设置变更不触发重连', async () => {
    await controller.initialize()
    await controller.connect()

    await controller.handleConnectionSettingsUpdated(
      buildSettings({ customResourceBaseUrl: 'http://127.0.0.1:6185', revision: 2 })
    )

    expect(harness.clients.length).toBe(1)
    expect(controller.getSnapshot().status).toBe('connected')
    expect(controller.getSnapshot().activeConfigRevision).toBe(2)
  })

  test('期望断开时设置变更不会发起连接', async () => {
    await controller.initialize()

    await controller.handleConnectionSettingsUpdated(
      buildSettings({ serverUrl: 'ws://127.0.0.1:9999', revision: 2 })
    )

    expect(harness.clients.length).toBe(0)
    expect(controller.getSnapshot().status).toBe('idle')
  })

  test('系统挂起时保留期望状态并在唤醒后恢复连接', async () => {
    await controller.initialize()
    await controller.connect()

    await controller.handleSystemSuspend('suspend')

    let snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('suspended')
    expect(snapshot.desiredState).toBe('connected')
    expect(snapshot.suspendReason).toBe('suspend')
    expect(harness.clients[0].closed).toBe(true)

    await controller.handleSystemResume()

    snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('connected')
    expect(snapshot.suspendReason).toBeNull()
    expect(harness.clients.length).toBe(2)
  })

  test('resumeDesiredConnectionOnWake 关闭时挂起直接放弃连接', async () => {
    harness.behaviorRecord.settings = buildBehavior({ resumeDesiredConnectionOnWake: false })
    controller = new BridgeConnectionController()
    await controller.initialize()
    await controller.connect()

    await controller.handleSystemSuspend('lock-screen')

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.desiredState).toBe('disconnected')

    await controller.handleSystemResume()
    expect(harness.clients.length).toBe(1)
  })

  test('initialize 时按行为设置自动连接', async () => {
    harness.behaviorRecord.settings = buildBehavior({ autoConnectOnAppLaunch: true })
    controller = new BridgeConnectionController()

    await controller.initialize()

    expect(harness.clients.length).toBe(1)
    expect(controller.getSnapshot().status).toBe('connected')
  })

  test('首次行为设置保存后解除启动决策挂起并自动连接', async () => {
    harness.behaviorRecord.exists = false
    harness.behaviorRecord.settings = buildBehavior({ autoConnectOnAppLaunch: true })
    controller = new BridgeConnectionController()
    await controller.initialize()
    expect(harness.clients.length).toBe(0)

    await controller.handleBehaviorSettingsUpdated(
      buildBehavior({ autoConnectOnAppLaunch: true }),
      {
        resolveStartupDecision: true
      }
    )

    expect(harness.clients.length).toBe(1)
    expect(controller.getSnapshot().status).toBe('connected')
  })

  test('waiting_retry 期间关闭自动重试会停在 error', async () => {
    harness.openResults.push(new Error('fail-1'))
    await controller.initialize()
    await controller.connect()
    expect(controller.getSnapshot().status).toBe('waiting_retry')

    await controller.handleBehaviorSettingsUpdated(buildBehavior({ retryEnabled: false }))

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.nextRetryAt).toBeNull()

    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)
  })

  test('未连接时 sendMessage 抛出错误', async () => {
    await controller.initialize()
    await expect(controller.sendMessage({ content: [] } as never)).rejects.toThrow()
  })

  test('活动客户端的表演事件转发给监听者', async () => {
    await controller.initialize()
    await controller.connect()

    const performPayloads: unknown[] = []
    const interrupts: number[] = []
    controller.on('perform:show', payload => performPayloads.push(payload))
    controller.on('perform:interrupt', () => interrupts.push(1))

    const client = harness.clients[0]
    client.emit('perform:show', { kind: 'text' })
    client.emit('perform:interrupt')

    expect(performPayloads).toEqual([{ kind: 'text' }])
    expect(interrupts.length).toBe(1)
  })

  test('断开后的旧客户端事件不再转发', async () => {
    await controller.initialize()
    await controller.connect()
    const client = harness.clients[0]
    await controller.disconnect()

    const performPayloads: unknown[] = []
    controller.on('perform:show', payload => performPayloads.push(payload))
    client.emit('perform:show', { kind: 'stale' })

    expect(performPayloads).toEqual([])
  })

  test('重连成功后再次异常断开，重试计数从 1 重新开始且会话清空', async () => {
    await controller.initialize()
    await controller.connect()

    harness.clients[0].setReady(false)
    harness.clients[0].emit('disconnected', { code: 1006, reason: 'first drop' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(controller.getSnapshot().status).toBe('connected')
    expect(controller.getSnapshot().reconnectAttempt).toBe(0)

    harness.clients[1].setReady(false)
    harness.clients[1].emit('disconnected', { code: 1006, reason: 'second drop' })

    const snapshot = controller.getSnapshot()
    expect(snapshot.status).toBe('waiting_retry')
    expect(snapshot.reconnectAttempt).toBe(1)
    expect(snapshot.session).toBeNull()
    expect(snapshot.lastError?.code).toBe('WS_UNEXPECTED_CLOSE')

    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.clients.length).toBe(3)
    expect(controller.getSnapshot().status).toBe('connected')
  })

  test('waiting_retry 期间系统挂起会取消重试定时器，唤醒后恢复连接', async () => {
    harness.openResults.push(new Error('fail-1'))
    await controller.initialize()
    await controller.connect()
    expect(controller.getSnapshot().status).toBe('waiting_retry')

    await controller.handleSystemSuspend('suspend')
    expect(controller.getSnapshot().status).toBe('suspended')

    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)

    await controller.handleSystemResume()
    expect(controller.getSnapshot().status).toBe('connected')
    expect(harness.clients.length).toBe(2)
  })

  test('dispose 关闭活动客户端并移除监听器，旧客户端事件不再生效', async () => {
    await controller.initialize()
    await controller.connect()
    const client = harness.clients[0]

    controller.dispose()

    expect(client.closed).toBe(true)
    expect(client.listenerCount('disconnected')).toBe(0)

    client.emit('disconnected', { code: 1006, reason: 'stale after dispose' })
    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)
  })

  test('waiting_retry 期间 dispose 取消定时器且不产生新客户端', async () => {
    harness.openResults.push(new Error('fail-1'))
    await controller.initialize()
    await controller.connect()
    expect(controller.getSnapshot().status).toBe('waiting_retry')

    controller.dispose()

    await vi.advanceTimersByTimeAsync(60000)
    expect(harness.clients.length).toBe(1)
  })
})

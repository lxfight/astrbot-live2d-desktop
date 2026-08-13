/**
 * 插件进程宿主（utilityProcess 封装）
 * 负责插件进程的 fork/RPC 通信/事件推送/看门狗重启。
 *
 * forker 与通知/网络能力通过依赖注入，便于在无 Electron 的测试环境验证。
 */

import type { PluginManifest } from '../../src/shared/pluginManifest'
import type {
  PluginHostEventPush,
  PluginHostRpcCall,
  PluginHostRpcResult
} from '../../src/shared/pluginManifest'
import type { PluginStorageStore } from '../database/PluginStorageStore'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('plugin.host')

export const PLUGIN_MAX_CRASH_RESTARTS = 5
export const PLUGIN_RESTART_BASE_DELAY_MS = 2000

export interface PluginProcessHandle {
  postMessage(message: unknown): void
  on(event: 'message', listener: (message: unknown) => void): void
  on(event: 'exit', listener: (code: number) => void): void
  kill(): boolean
  readonly pid?: number
}

export interface PluginProcessForker {
  fork(modulePath: string, args: string[]): PluginProcessHandle
}

export interface PluginHostOptions {
  forker: PluginProcessForker
  runtimeEntryPath: string
  storageStore: PluginStorageStore
  /** 崩溃达到上限时的回调（宿主据此标记 quarantined） */
  onQuarantine: (pluginId: string, reason: string) => void
  /** 通知能力注入（默认 Electron Notification，测试注入假实现） */
  notifications?: {
    show(pluginId: string, title: string, body?: string): void
  }
  /** 网络能力注入（默认受控 fetch：仅 http/https，超时上限） */
  fetch?: (pluginId: string, url: string, init?: { timeoutMs?: number }) => Promise<unknown>
}

export class PluginHost {
  private readonly processes = new Map<string, PluginProcessHandle>()
  private readonly crashCounts = new Map<string, number>()
  private readonly restartTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 用户主动停止的插件：kill 触发的 exit 不走崩溃重启流程 */
  private readonly intentionalStops = new Set<string>()

  constructor(private readonly options: PluginHostOptions) {}

  isRunning(pluginId: string): boolean {
    return this.processes.has(pluginId)
  }

  /** fork 插件进程并建立 RPC 通道 */
  startPlugin(pluginId: string, pluginDirectory: string, manifest: PluginManifest): void {
    if (this.processes.has(pluginId)) {
      logger.warn('start.already_running', { pluginId })
      return
    }
    // 清理上一次主动停止遗留的标记，避免延迟送达的 exit 吞掉本次崩溃
    this.intentionalStops.delete(pluginId)

    logger.info('start.begin', { pluginId, entry: manifest.entry })
    let handle: PluginProcessHandle
    try {
      handle = this.options.forker.fork(this.options.runtimeEntryPath, [pluginDirectory])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('start.fork_failed', error)
      this.handleCrash(pluginId, pluginDirectory, manifest, message)
      return
    }

    this.processes.set(pluginId, handle)
    handle.on('message', (message: unknown) => {
      this.handleRpcMessage(pluginId, manifest, message)
    })
    handle.on('exit', code => {
      logger.warn('process.exit', { pluginId, code })
      // 陈旧句柄的延迟 exit：当前活动句柄已不是它，忽略
      if (this.processes.get(pluginId) !== handle) {
        return
      }
      this.processes.delete(pluginId)
      if (this.intentionalStops.has(pluginId)) {
        this.intentionalStops.delete(pluginId)
        logger.info('process.exit.intentional', { pluginId, code })
        return
      }
      this.handleCrash(pluginId, pluginDirectory, manifest, `exit code ${code}`)
    })
  }

  /** 停用插件：取消重启定时器并 kill 进程（kill 触发的 exit 不重启） */
  stopPlugin(pluginId: string): void {
    const restartTimer = this.restartTimers.get(pluginId)
    if (restartTimer) {
      clearTimeout(restartTimer)
      this.restartTimers.delete(pluginId)
    }

    const handle = this.processes.get(pluginId)
    if (handle) {
      logger.info('stop.kill', { pluginId })
      // kill 返回 false 时 exit 可能延迟送达，标记保留以确保不触发崩溃重启
      this.intentionalStops.add(pluginId)
      handle.kill()
      this.processes.delete(pluginId)
    }
    this.crashCounts.delete(pluginId)
  }

  /** 停用全部插件（应用退出清理） */
  stopAll(): void {
    for (const pluginId of Array.from(this.processes.keys())) {
      this.stopPlugin(pluginId)
    }
  }

  /** 推送事件给订阅该事件的运行中插件 */
  pushEvent(
    pluginId: string,
    kind: NonNullable<PluginManifest['subscriptions']>[number],
    payload: unknown
  ): void {
    const handle = this.processes.get(pluginId)
    if (!handle) {
      return
    }
    const message: PluginHostEventPush = { type: 'event', kind, payload }
    try {
      handle.postMessage(message)
    } catch {
      // 进程退出竞态：postMessage 失败忽略，exit 事件会走重启流程
    }
  }

  private handleRpcMessage(pluginId: string, manifest: PluginManifest, message: unknown): void {
    if (!isRecord(message) || message.type !== 'rpc') {
      return
    }

    const call = message as unknown as PluginHostRpcCall
    const handle = this.processes.get(pluginId)
    if (!handle) {
      return
    }

    const respond = (ok: boolean, value?: unknown, error?: string) => {
      const result: PluginHostRpcResult = { type: 'rpc-result', id: call.id, ok, value, error }
      try {
        handle.postMessage(result)
      } catch {
        // 进程退出竞态忽略
      }
    }

    Promise.resolve()
      .then(() => this.dispatchMethod(pluginId, manifest, call))
      .then(value => respond(true, value))
      .catch(error =>
        respond(false, undefined, error instanceof Error ? error.message : String(error))
      )
  }

  private async dispatchMethod(
    pluginId: string,
    manifest: PluginManifest,
    call: PluginHostRpcCall
  ): Promise<unknown> {
    const params = call.params ?? []
    const permissions = new Set(manifest.permissions ?? [])

    switch (call.method) {
      case 'storage.get': {
        this.requirePermission(pluginId, permissions, 'storage')
        return this.options.storageStore.getValue(pluginId, String(params[0]))
      }
      case 'storage.set': {
        this.requirePermission(pluginId, permissions, 'storage')
        const key = String(params[0])
        if (key.startsWith('__host.')) {
          throw new Error('宿主保留键不可写')
        }
        this.options.storageStore.setValue(pluginId, key, JSON.stringify(params[1]))
        return undefined
      }
      case 'storage.remove': {
        this.requirePermission(pluginId, permissions, 'storage')
        return this.options.storageStore.removeValue(pluginId, String(params[0]))
      }
      case 'storage.keys': {
        this.requirePermission(pluginId, permissions, 'storage')
        return this.options.storageStore.getKeys(pluginId).filter(key => !key.startsWith('__host.'))
      }
      case 'notification.show': {
        this.requirePermission(pluginId, permissions, 'notifications')
        this.options.notifications?.show(pluginId, String(params[0]), String(params[1] ?? ''))
        return undefined
      }
      case 'network.fetch': {
        this.requirePermission(pluginId, permissions, 'network')
        const url = String(params[0])
        return await this.options.fetch?.(pluginId, url, params[1] as { timeoutMs?: number })
      }
      case 'log.debug':
      case 'log.info':
      case 'log.warn':
      case 'log.error': {
        const level = call.method.split('.')[1] as 'debug' | 'info' | 'warn' | 'error'
        const message = params.map(value => stringifyLogValue(value)).join(' ')
        logger[level]('plugin_log', { pluginId, message })
        return undefined
      }
      default:
        throw new Error(`未知方法: ${call.method}`)
    }
  }

  private requirePermission(pluginId: string, permissions: Set<string>, required: string): void {
    if (!permissions.has(required)) {
      throw new Error(`插件 ${pluginId} 未授权 ${required}`)
    }
  }

  private handleCrash(
    pluginId: string,
    pluginDirectory: string,
    manifest: PluginManifest,
    reason: string
  ): void {
    const crashCount = (this.crashCounts.get(pluginId) ?? 0) + 1
    this.crashCounts.set(pluginId, crashCount)

    if (crashCount > PLUGIN_MAX_CRASH_RESTARTS) {
      logger.error('crash.quarantined', new Error(reason), { pluginId, crashCount })
      this.options.onQuarantine(pluginId, reason)
      this.crashCounts.delete(pluginId)
      return
    }

    const delay = PLUGIN_RESTART_BASE_DELAY_MS * Math.pow(2, crashCount - 1)
    logger.warn('crash.restart_scheduled', { pluginId, crashCount, delayMs: delay, reason })
    const timer = setTimeout(() => {
      this.restartTimers.delete(pluginId)
      logger.info('crash.restarting', { pluginId, crashCount })
      this.startPlugin(pluginId, pluginDirectory, manifest)
    }, delay)
    this.restartTimers.set(pluginId, timer)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

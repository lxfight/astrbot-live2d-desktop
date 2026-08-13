/**
 * 插件运行时（utilityProcess 入口）
 * 在插件进程中运行：加载插件 entry，注入宿主 API 对象，
 * 通过 process.parentPort 与主进程做 RPC 通信。
 *
 * 该文件由 vite-plugin-electron 单独打包（见 vite.config.ts），
 * 产物路径通过 PluginManager 组装时传入 PluginHost。
 */

import path from 'node:path'

type RpcCall = { type: 'rpc'; id: number; method: string; params?: unknown[] }
type RpcResult = { type: 'rpc-result'; id: number; ok: boolean; value?: unknown; error?: string }

const rawPort = (process as unknown as { parentPort: ParentPort | null }).parentPort

interface ParentPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

if (!rawPort) {
  throw new Error('pluginRuntime 必须由 utilityProcess 启动')
}
// 收窄为不可空：后续所有 RPC 通路共用
const parentPort: ParentPort = rawPort

interface HostApi {
  storage: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
  }
  notifications: {
    show(title: string, body?: string): Promise<void>
  }
  fetch(url: string, init?: { timeoutMs?: number }): Promise<unknown>
  log: {
    debug(...args: unknown[]): void
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  events: {
    /** 订阅宿主推送的事件（需 manifest.subscriptions 声明对应事件，宿主侧过滤） */
    on(kind: string, listener: (payload: unknown) => void): void
  }
}

/**
 * 宿主推送事件的分发器：parentPort 的 message 监听里同时处理 rpc-result
 * 与 event 两种消息。插件通过 api.events.on(kind, listener) 注册。
 */
const eventListeners = new Map<string, Set<(payload: unknown) => void>>()

function registerEventDispatch(kind: string, listener: (payload: unknown) => void): void {
  let set = eventListeners.get(kind)
  if (!set) {
    set = new Set()
    eventListeners.set(kind, set)
  }
  set.add(listener)
}

function dispatchEvent(kind: string, payload: unknown): void {
  const set = eventListeners.get(kind)
  if (!set) {
    return
  }
  for (const listener of set) {
    try {
      listener(payload)
    } catch (error) {
      // 插件事件回调异常不应中断分发；宿主 log 通道上报
      console.warn(`[pluginRuntime] 事件回调异常 (${kind}):`, error)
    }
  }
}

parentPort.on('message', event => {
  const message = event.data as { type?: string; kind?: string; payload?: unknown } | null
  if (!message) {
    return
  }
  if (message.type === 'event') {
    dispatchEvent(message.kind ?? '', message.payload)
  }
})

/**
 * 把宿主方法包装成 RPC 调用；log 用 fire-and-forget，其余等待响应。
 */
function createRpcProxy(): HostApi {
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()

  parentPort.on('message', event => {
    const message = event.data as { type?: string; id?: number } | null
    if (!message || message.type !== 'rpc-result') {
      return
    }
    const { id, ok, value, error } = message as RpcResult
    const entry = pending.get(id)
    if (!entry) {
      return
    }
    pending.delete(id)
    if (ok) {
      entry.resolve(value)
    } else {
      entry.reject(new Error(error ?? 'RPC 失败'))
    }
  })

  function call(method: string, ...params: unknown[]): Promise<unknown> {
    const id = nextId++
    const rpc: RpcCall = { type: 'rpc', id, method, params }
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      parentPort.postMessage(rpc)
    })
  }

  return {
    storage: {
      get: key => call('storage.get', key),
      set: async (key, value) => {
        await call('storage.set', key, value)
      },
      remove: async key => {
        await call('storage.remove', key)
      },
      keys: () => call('storage.keys') as Promise<string[]>
    },
    notifications: {
      show: async (title, body) => {
        await call('notification.show', title, body)
      }
    },
    fetch: (url, init) => call('network.fetch', url, init),
    log: {
      debug: (...args) => void call('log.debug', ...args),
      info: (...args) => void call('log.info', ...args),
      warn: (...args) => void call('log.warn', ...args),
      error: (...args) => void call('log.error', ...args)
    },
    events: {
      // 宿主推送的 event 消息由主循环分发（见 registerEventDispatch），
      // 这里只需注册监听即可
      on: (kind, listener) => {
        registerEventDispatch(kind, listener)
      }
    }
  }
}

async function main(): Promise<void> {
  const pluginDirectory = process.argv[2]
  if (!pluginDirectory) {
    throw new Error('缺少插件目录参数')
  }

  const manifestPath = path.join(pluginDirectory, 'manifest.json')
  // 清单已由主进程校验，这里仅读取 entry 字段
  const { readFileSync } = await import('node:fs')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { entry: string }
  const entryPath = path.join(pluginDirectory, manifest.entry)

  const api = createRpcProxy()

  // 动态 import 支持 CJS 与 ESM 打包产物；file:// URL 保证绝对路径解析
  const entryModule = await import(`file://${entryPath}`)
  const entrypoint =
    (entryModule as { default?: unknown }).default ??
    (entryModule as unknown as Record<string, unknown>).default

  if (typeof entrypoint !== 'function') {
    throw new Error(`插件入口未导出函数: ${manifest.entry}`)
  }

  const cleanup = entrypoint(api)
  if (cleanup && typeof (cleanup as { onDisable?: () => void }).onDisable === 'function') {
    const onDisable = (cleanup as { onDisable: () => void }).onDisable
    parentPort.on('message', event => {
      const message = event.data as { type?: string } | null
      if (message?.type === 'command' && (message as { action?: string }).action === 'disable') {
        onDisable()
      }
    })
  }

  parentPort.postMessage({ type: 'ready' })
}

main().catch(error => {
  // 入口加载失败：把错误回给主进程后退出
  parentPort.postMessage({
    type: 'fatal',
    error: error instanceof Error ? error.message : String(error)
  })
  process.exit(1)
})

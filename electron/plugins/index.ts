/**
 * 插件系统装配层
 * 组装 PluginManager / PluginHost 的真实依赖（数据库、utilityProcess、通知），
 * 暴露单例与生命周期入口，供 main.ts 与 IPC 处理器使用。
 */

import path from 'node:path'
import { Notification, utilityProcess, app } from 'electron'
import { PluginManager } from './PluginManager'
import { PluginHost, type PluginProcessForker } from './PluginHost'
import { PluginStorageStore } from '../database/PluginStorageStore'
import { getDatabase } from '../database/schema'
import { getAppDataPath } from '../utils/appPaths'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('plugin.system')

let pluginManager: PluginManager | null = null
let pluginHost: PluginHost | null = null

/** utilityProcess 封装为 PluginHost 期望的 forker 接口 */
const utilityProcessForker: PluginProcessForker = {
  fork(modulePath: string, args: string[]) {
    return utilityProcess.fork(modulePath, args, {
      serviceName: 'astrbot-plugin-host'
    })
  }
}

/** 受控网络：仅 http/https，超时 10s（插件 API 的 network.fetch 兜底实现） */
async function controlledFetch(
  _pluginId: string,
  url: string,
  init?: { timeoutMs?: number }
): Promise<unknown> {
  const timeoutMs = Math.min(Math.max(init?.timeoutMs ?? 10_000, 1000), 60_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return { status: response.status, ok: response.ok }
  } finally {
    clearTimeout(timer)
  }
}

export function initializePluginSystem(): void {
  if (pluginManager && pluginHost) {
    return
  }

  const storageStore = new PluginStorageStore(getDatabase())
  const pluginsRootDirectory = path.join(getAppDataPath(), 'plugins')

  const manager = new PluginManager({
    pluginsRootDirectory,
    appVersion: app.getVersion(),
    storageStore
  })
  manager.ensureRootDirectory()

  const host = new PluginHost({
    forker: utilityProcessForker,
    runtimeEntryPath: getPluginRuntimeEntryPath(),
    storageStore,
    onQuarantine: (pluginId, reason) => {
      manager.setRuntimeStatus(pluginId, 'quarantined')
      logger.error('quarantined', new Error(reason), { pluginId })
    },
    notifications: {
      show: (pluginId, title, body) => {
        if (!Notification.isSupported()) {
          logger.warn('notification.unsupported', { pluginId })
          return
        }
        new Notification({ title, body: body || undefined, silent: false }).show()
      }
    },
    fetch: controlledFetch
  })

  pluginManager = manager
  pluginHost = host

  // 拉起上次启用的插件
  for (const pluginId of manager.getAutoEnableIds()) {
    const info = manager.getPlugin(pluginId)
    if (!info) {
      continue
    }
    host.startPlugin(pluginId, path.join(pluginsRootDirectory, pluginId), info.manifest)
  }

  logger.info('initialize.success', {
    pluginsRootDirectory,
    autoStarted: manager.getAutoEnableIds().length
  })
}

/** 运行时入口产物路径：开发走源文件编译产物，打包后位于 dist-electron */
export function getPluginRuntimeEntryPath(): string {
  return path.join(app.getAppPath(), 'dist-electron', 'pluginRuntime.js')
}

export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    throw new Error('插件系统未初始化')
  }
  return pluginManager
}

export function getPluginHost(): PluginHost {
  if (!pluginHost) {
    throw new Error('插件系统未初始化')
  }
  return pluginHost
}

/** 应用退出时停止全部插件进程 */
export function shutdownPluginSystem(): void {
  if (pluginHost) {
    pluginHost.stopAll()
  }
  pluginHost = null
  pluginManager = null
  logger.info('shutdown.success')
}

/**
 * 插件管理器（单例）
 * 负责插件目录管理、安装/卸载、启用状态与设置读写。
 * 进程生命周期（utilityProcess fork/RPC）由 PluginHost 负责，见 PluginHost.ts。
 *
 * 依赖通过构造函数注入（根目录、存储、版本），便于单元测试；
 * 应用启动时由 electron/plugins/index.ts 组装真实依赖。
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  PluginInfo,
  PluginManifest,
  PluginRuntimeStatus
} from '../../src/shared/pluginManifest'
import { validatePluginManifestFile } from './ManifestValidator'
import type { PluginStorageStore } from '../database/PluginStorageStore'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('plugin.manager')

/** 宿主保留的存储键（插件不可见，PluginHost 会过滤掉 __host 前缀） */
const RESERVED_ENABLED_KEY = '__host.enabled'
const RESERVED_SETTINGS_KEY = '__host.settings'
export const PLUGIN_RESERVED_KEY_PREFIX = '__host.'

export interface PluginManagerOptions {
  pluginsRootDirectory: string
  appVersion: string
  storageStore: PluginStorageStore
  /** 看门狗诊断信息提供者（PluginHost 注入，缺失时回退为 0/null） */
  diagnostics?: (pluginId: string) => { crashCount: number; lastError: string | null }
}

export type PluginCommandResult = {
  success: boolean
  pluginId?: string
  error?: string
}

export class PluginManager {
  private readonly runtimeStatus = new Map<string, PluginRuntimeStatus>()

  constructor(private readonly options: PluginManagerOptions) {}

  get pluginsRootDirectory(): string {
    return this.options.pluginsRootDirectory
  }

  ensureRootDirectory(): void {
    fs.mkdirSync(this.options.pluginsRootDirectory, { recursive: true })
  }

  /** 扫描插件目录，返回已安装插件的完整信息（含运行时状态与设置） */
  listPlugins(): PluginInfo[] {
    this.ensureRootDirectory()
    const infos: PluginInfo[] = []

    for (const directoryName of fs.readdirSync(this.options.pluginsRootDirectory)) {
      const pluginDirectory = path.join(this.options.pluginsRootDirectory, directoryName)
      if (!fs.statSync(pluginDirectory).isDirectory()) {
        continue
      }

      const validation = validatePluginManifestFile(pluginDirectory, {
        appVersion: this.options.appVersion
      })
      if (!validation.valid) {
        logger.warn('list.skip_invalid', {
          directory: directoryName,
          errors: validation.errors.map(error => error.code)
        })
        continue
      }

      const manifest = validation.manifest
      const storedSettings = this.options.storageStore.getValue(manifest.id, RESERVED_SETTINGS_KEY)
      const diagnostics = this.options.diagnostics?.(manifest.id) ?? {
        crashCount: 0,
        lastError: null
      }
      infos.push({
        manifest,
        status: this.runtimeStatus.get(manifest.id) ?? this.resolvePersistedStatus(manifest.id),
        settings: this.mergeSettingsWithDefaults(manifest, storedSettings),
        crashCount: diagnostics.crashCount,
        lastError: diagnostics.lastError,
        installedAt: this.resolveInstalledAt(pluginDirectory)
      })
    }

    return infos.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id))
  }

  getPlugin(id: string): PluginInfo | null {
    return this.listPlugins().find(info => info.manifest.id === id) ?? null
  }

  /** 从任意目录安装插件：先校验（含目录名与 id 一致），再复制到插件根目录 */
  installPluginFromDirectory(sourceDirectory: string): PluginCommandResult {
    this.ensureRootDirectory()
    const directoryName = path.basename(sourceDirectory)

    const validation = validatePluginManifestFile(sourceDirectory, {
      appVersion: this.options.appVersion
    })
    if (!validation.valid) {
      const message = validation.errors.map(error => error.message).join('; ')
      logger.warn('install.rejected', { directory: directoryName, message })
      return { success: false, error: message }
    }

    const targetDirectory = path.join(this.options.pluginsRootDirectory, directoryName)
    if (fs.existsSync(targetDirectory)) {
      logger.warn('install.exists', { directory: directoryName })
      return { success: false, error: `插件已存在: ${directoryName}` }
    }

    try {
      fs.cpSync(sourceDirectory, targetDirectory, { recursive: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('install.copy_failed', { directory: directoryName, message })
      return { success: false, error: message }
    }

    logger.info('install.success', {
      pluginId: validation.manifest.id,
      version: validation.manifest.version
    })
    return { success: true, pluginId: validation.manifest.id }
  }

  /** 卸载插件：停止进程、删除目录、清空存储 */
  uninstallPlugin(id: string): PluginCommandResult {
    const info = this.getPlugin(id)
    if (!info) {
      return { success: false, error: `插件不存在: ${id}` }
    }

    this.runtimeStatus.delete(id)
    this.options.storageStore.clear(id)

    const pluginDirectory = path.join(this.options.pluginsRootDirectory, id)
    try {
      fs.rmSync(pluginDirectory, { recursive: true, force: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('uninstall.remove_failed', { pluginId: id, message })
      return { success: false, error: message }
    }

    logger.info('uninstall.success', { pluginId: id })
    return { success: true, pluginId: id }
  }

  /** 启用插件并持久化状态（进程启动由 PluginHost 接管） */
  enablePlugin(id: string): PluginCommandResult {
    const info = this.getPlugin(id)
    if (!info) {
      return { success: false, error: `插件不存在: ${id}` }
    }
    if (info.status === 'quarantined') {
      return { success: false, error: '插件处于隔离状态，需重新安装或修复后启用' }
    }

    this.options.storageStore.setValue(id, RESERVED_ENABLED_KEY, '1')
    this.runtimeStatus.set(id, 'running')
    logger.info('enable.success', { pluginId: id })
    return { success: true, pluginId: id }
  }

  /** 停用插件并持久化状态（进程停止由 PluginHost 接管） */
  disablePlugin(id: string): PluginCommandResult {
    const info = this.getPlugin(id)
    if (!info) {
      return { success: false, error: `插件不存在: ${id}` }
    }

    this.options.storageStore.setValue(id, RESERVED_ENABLED_KEY, '0')
    this.runtimeStatus.set(id, 'disabled')
    logger.info('disable.success', { pluginId: id })
    return { success: true, pluginId: id }
  }

  /** 返回自动启用清单（应用启动时 PluginHost 依次拉起） */
  getAutoEnableIds(): string[] {
    return this.listPlugins()
      .filter(info => this.resolvePersistedStatus(info.manifest.id) === 'running')
      .map(info => info.manifest.id)
  }

  /** 由 PluginHost 上报进程状态（crash 隔离、进程退出等） */
  setRuntimeStatus(id: string, status: PluginRuntimeStatus): void {
    this.runtimeStatus.set(id, status)
  }

  getPluginSettings(id: string): Record<string, unknown> | null {
    const info = this.getPlugin(id)
    if (!info) {
      return null
    }
    return info.settings
  }

  /** 按清单 settings schema 校验后合并写入 */
  updatePluginSettings(id: string, patch: Record<string, unknown>): PluginCommandResult {
    const info = this.getPlugin(id)
    if (!info) {
      return { success: false, error: `插件不存在: ${id}` }
    }

    const schemaByKey = new Map((info.manifest.settings ?? []).map(schema => [schema.key, schema]))
    const errors: string[] = []
    const next = { ...info.settings }

    for (const [key, value] of Object.entries(patch)) {
      const schema = schemaByKey.get(key)
      if (!schema) {
        errors.push(`未知设置项: ${key}`)
        continue
      }
      const validationError = this.validateSettingValue(schema, value)
      if (validationError) {
        errors.push(`${key}: ${validationError}`)
        continue
      }
      next[key] = value
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') }
    }

    this.options.storageStore.setValue(id, RESERVED_SETTINGS_KEY, JSON.stringify(next))
    return { success: true, pluginId: id }
  }

  private validateSettingValue(
    schema: NonNullable<PluginManifest['settings']>[number],
    value: unknown
  ): string | null {
    switch (schema.kind) {
      case 'text':
        return typeof value === 'string' ? null : '需要字符串'
      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return '需要数字'
        }
        if (schema.min !== undefined && value < schema.min) {
          return `不能小于 ${schema.min}`
        }
        if (schema.max !== undefined && value > schema.max) {
          return `不能大于 ${schema.max}`
        }
        return null
      }
      case 'boolean':
        return typeof value === 'boolean' ? null : '需要布尔值'
      case 'select': {
        const allowed = (schema.options ?? []).map(option => option.value)
        return typeof value === 'string' && allowed.includes(value) ? null : '不在可选范围内'
      }
      case 'multiSelect': {
        const allowed = (schema.options ?? []).map(option => option.value)
        return Array.isArray(value) && value.every(item => allowed.includes(item))
          ? null
          : '不在可选范围内'
      }
      default:
        return null
    }
  }

  private resolvePersistedStatus(id: string): PluginRuntimeStatus {
    return this.options.storageStore.getValue(id, RESERVED_ENABLED_KEY) === '1'
      ? 'running'
      : 'disabled'
  }

  private mergeSettingsWithDefaults(
    manifest: PluginManifest,
    storedSettingsRaw: string | null
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    for (const schema of manifest.settings ?? []) {
      if (schema.defaultValue !== undefined) {
        merged[schema.key] = schema.defaultValue
      }
    }

    if (storedSettingsRaw) {
      try {
        const stored = JSON.parse(storedSettingsRaw) as Record<string, unknown>
        Object.assign(merged, stored)
      } catch {
        logger.warn('settings.parse_failed', { pluginId: manifest.id })
      }
    }

    return merged
  }

  private resolveInstalledAt(pluginDirectory: string): number {
    try {
      return Math.floor(fs.statSync(pluginDirectory).mtimeMs)
    } catch {
      return 0
    }
  }
}

/**
 * 插件清单校验器
 * 安装/加载前对 manifest 做静态校验，拒绝非法插件。
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  PluginManifest,
  PluginPermission,
  PluginSettingsSchema
} from '../../src/shared/pluginManifest'
import {
  PLUGIN_EVENT_VALID_VALUES,
  PLUGIN_PERMISSION_VALID_VALUES
} from '../../src/shared/pluginManifest'
import { PLUGIN_ID_PATTERN } from '../../src/shared/pluginSdk'

export type ManifestValidationErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_FIELD'
  | 'BAD_ID'
  | 'BAD_VERSION'
  | 'BAD_ENTRY'
  | 'BAD_PERMISSION'
  | 'BAD_SUBSCRIPTION'
  | 'BAD_SETTINGS'
  | 'BAD_TRAY_MENU'
  | 'APP_VERSION_TOO_LOW'

export interface ManifestValidationError {
  code: ManifestValidationErrorCode
  message: string
}

export type ManifestValidationResult =
  | { valid: true; manifest: PluginManifest }
  | { valid: false; errors: ManifestValidationError[] }

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** 解析 semver 核心三段（忽略预发布标识），返回 [major, minor, patch]，非法返回 null */
export function parseSemverCore(version: string): [number, number, number] | null {
  const match = SEMVER_PATTERN.exec(version.trim())
  if (!match) {
    return null
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** current >= minimum 时为 true；任一版本非法返回 false */
export function satisfiesMinVersion(current: string, minimum: string): boolean {
  const currentCore = parseSemverCore(current)
  const minimumCore = parseSemverCore(minimum)
  if (!currentCore || !minimumCore) {
    return false
  }
  for (let index = 0; index < 3; index++) {
    if (currentCore[index] !== minimumCore[index]) {
      return currentCore[index] > minimumCore[index]
    }
  }
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateRequiredString(record: Record<string, unknown>, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' && value.trim() ? (value as string) : null
}

function validatePermissions(value: unknown, errors: ManifestValidationError[]): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_PERMISSION', message: 'permissions 必须是数组' })
    return
  }
  for (const permission of value) {
    if (!PLUGIN_PERMISSION_VALID_VALUES.includes(permission as PluginPermission)) {
      errors.push({ code: 'BAD_PERMISSION', message: `未知权限: ${String(permission)}` })
    }
  }
}

function validateSubscriptions(value: unknown, errors: ManifestValidationError[]): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_SUBSCRIPTION', message: 'subscriptions 必须是数组' })
    return
  }
  for (const kind of value) {
    if (!PLUGIN_EVENT_VALID_VALUES.includes(kind as never)) {
      errors.push({ code: 'BAD_SUBSCRIPTION', message: `未知事件: ${String(kind)}` })
    }
  }
}

function validateSettings(value: unknown, errors: ManifestValidationError[]): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_SETTINGS', message: 'settings 必须是数组' })
    return
  }
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string' || !item.key.trim()) {
      errors.push({ code: 'BAD_SETTINGS', message: 'settings 项缺少 key' })
      continue
    }
    const kind = item.kind as PluginSettingsSchema['kind']
    if (!['text', 'number', 'boolean', 'select', 'multiSelect'].includes(kind)) {
      errors.push({ code: 'BAD_SETTINGS', message: `settings 项 ${item.key} 类型非法` })
    }
    if ((kind === 'select' || kind === 'multiSelect') && !Array.isArray(item.options)) {
      errors.push({ code: 'BAD_SETTINGS', message: `settings 项 ${item.key} 缺少 options` })
    }
  }
}

function validateTrayMenu(
  value: unknown,
  permissions: unknown,
  errors: ManifestValidationError[]
): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_TRAY_MENU', message: 'trayMenu 必须是数组' })
    return
  }
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim()) {
      errors.push({ code: 'BAD_TRAY_MENU', message: 'trayMenu 项缺少 id' })
    }
  }
  // trayMenu 需要 trayMenu 权限（宿主构建菜单时的双重检查）
  const hasTrayPermission = Array.isArray(permissions) && permissions.includes('trayMenu' as never)
  if (!hasTrayPermission) {
    errors.push({
      code: 'BAD_TRAY_MENU',
      message: '声明 trayMenu 需要 trayMenu 权限'
    })
  }
}

/**
 * 校验清单对象（不含文件系统访问），供单元测试与运行时共用。
 */
export function validatePluginManifestObject(
  raw: unknown,
  options: { directoryName?: string; appVersion?: string } = {}
): ManifestValidationResult {
  if (!isRecord(raw)) {
    return { valid: false, errors: [{ code: 'INVALID_JSON', message: '清单必须是对象' }] }
  }

  const errors: ManifestValidationError[] = []
  const id = validateRequiredString(raw, 'id')
  const name = validateRequiredString(raw, 'name')
  const version = validateRequiredString(raw, 'version')
  const entry = validateRequiredString(raw, 'entry')
  const author = validateRequiredString(raw, 'author')

  if (!id) {
    errors.push({ code: 'MISSING_FIELD', message: '缺少 id' })
  } else if (!PLUGIN_ID_PATTERN.test(id)) {
    errors.push({ code: 'BAD_ID', message: `id 格式非法: ${id}` })
  }

  if (!name) {
    errors.push({ code: 'MISSING_FIELD', message: '缺少 name' })
  }

  if (!version) {
    errors.push({ code: 'MISSING_FIELD', message: '缺少 version' })
  } else if (!parseSemverCore(version)) {
    errors.push({ code: 'BAD_VERSION', message: `version 不是合法 semver: ${version}` })
  }

  if (!entry) {
    errors.push({ code: 'MISSING_FIELD', message: '缺少 entry' })
  } else if (path.isAbsolute(entry) || entry.includes('..')) {
    errors.push({ code: 'BAD_ENTRY', message: 'entry 不能是绝对路径或包含 ..' })
  }

  if (!author) {
    errors.push({ code: 'MISSING_FIELD', message: '缺少 author' })
  }

  if (options.directoryName && id && options.directoryName !== id) {
    errors.push({
      code: 'BAD_ID',
      message: `id 与目录名不一致: ${id} != ${options.directoryName}`
    })
  }

  if (raw.minAppVersion !== undefined && options.appVersion) {
    if (
      typeof raw.minAppVersion !== 'string' ||
      !satisfiesMinVersion(options.appVersion, raw.minAppVersion)
    ) {
      errors.push({
        code: 'APP_VERSION_TOO_LOW',
        message: `需要桌面端 >= ${String(raw.minAppVersion)}，当前 ${options.appVersion}`
      })
    }
  }

  validatePermissions(raw.permissions, errors)
  validateSubscriptions(raw.subscriptions, errors)
  validateSettings(raw.settings, errors)
  validateTrayMenu(raw.trayMenu, raw.permissions, errors)

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    manifest: {
      id: id as string,
      name: name as string,
      version: version as string,
      author: author as string,
      description: typeof raw.description === 'string' ? raw.description : '',
      entry: entry as string,
      minAppVersion: typeof raw.minAppVersion === 'string' ? raw.minAppVersion : undefined,
      permissions: (raw.permissions as PluginPermission[] | undefined)?.slice(),
      settings: (raw.settings as PluginSettingsSchema[] | undefined)?.slice(),
      trayMenu: (raw.trayMenu as PluginManifest['trayMenu'] | undefined)?.slice(),
      subscriptions: (raw.subscriptions as PluginManifest['subscriptions'] | undefined)?.slice()
    }
  }
}

/**
 * 读取并校验插件目录下的 manifest.json。
 */
export function validatePluginManifestFile(
  pluginDirectory: string,
  options: { appVersion?: string } = {}
): ManifestValidationResult {
  const manifestPath = path.join(pluginDirectory, 'manifest.json')

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_JSON',
          message: `读取 manifest.json 失败: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    }
  }

  const result = validatePluginManifestObject(raw, {
    directoryName: path.basename(pluginDirectory),
    appVersion: options.appVersion
  })

  if (!result.valid) {
    return result
  }

  // entry 文件必须存在
  const entryPath = path.join(pluginDirectory, result.manifest.entry)
  if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
    return {
      valid: false,
      errors: [{ code: 'BAD_ENTRY', message: `入口文件不存在: ${result.manifest.entry}` }]
    }
  }

  return result
}

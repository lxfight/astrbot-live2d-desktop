/**
 * ManifestValidator 测试
 * 覆盖清单对象校验（白名单/必填项/semver）与文件读取校验
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  parseSemverCore,
  satisfiesMinVersion,
  validatePluginManifestObject,
  validatePluginManifestFile
} from '../electron/plugins/ManifestValidator'

function buildManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'hello-plugin',
    name: 'Hello',
    version: '1.0.0',
    author: 'tester',
    entry: 'index.js',
    ...overrides
  }
}

describe('parseSemverCore / satisfiesMinVersion', () => {
  test('解析合法 semver', () => {
    expect(parseSemverCore('1.2.3')).toEqual([1, 2, 3])
    expect(parseSemverCore(' 10.0.0-beta.1 ')).toEqual([10, 0, 0])
  })

  test('拒绝非法版本', () => {
    expect(parseSemverCore('1.2')).toBeNull()
    expect(parseSemverCore('v1.2.3')).toBeNull()
    expect(parseSemverCore('latest')).toBeNull()
    expect(parseSemverCore('')).toBeNull()
  })

  test('版本比较覆盖大于/等于/小于', () => {
    expect(satisfiesMinVersion('1.6.0', '1.6.0')).toBe(true)
    expect(satisfiesMinVersion('1.6.1', '1.6.0')).toBe(true)
    expect(satisfiesMinVersion('2.0.0', '1.9.9')).toBe(true)
    expect(satisfiesMinVersion('1.5.9', '1.6.0')).toBe(false)
    expect(satisfiesMinVersion('1.6.0', '2.0.0')).toBe(false)
  })

  test('任一非法版本返回 false', () => {
    expect(satisfiesMinVersion('invalid', '1.0.0')).toBe(false)
    expect(satisfiesMinVersion('1.6.0', 'invalid')).toBe(false)
  })
})

describe('validatePluginManifestObject', () => {
  test('合法清单通过并规范化字段', () => {
    const result = validatePluginManifestObject(
      buildManifest({
        permissions: ['storage', 'events', 'trayMenu'],
        settings: [
          { key: 'city', kind: 'text', label: '城市' },
          {
            key: 'units',
            kind: 'select',
            label: '单位',
            options: [
              { label: '公制', value: 'metric' },
              { label: '英制', value: 'imperial' }
            ]
          }
        ],
        trayMenu: [{ id: 'toggle', label: '切换' }],
        subscriptions: ['message:received']
      }),
      { directoryName: 'hello-plugin' }
    )

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.manifest.permissions).toEqual(['storage', 'events', 'trayMenu'])
      expect(result.manifest.description).toBe('')
    }
  })

  test('非对象输入报 INVALID_JSON', () => {
    const result = validatePluginManifestObject(null)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors[0].code).toBe('INVALID_JSON')
    }
  })

  test('缺少必填字段逐项报错', () => {
    const result = validatePluginManifestObject({})
    expect(result.valid).toBe(false)
    if (!result.valid) {
      const codes = result.errors.map(error => error.code)
      expect(codes).toContain('MISSING_FIELD')
      expect(result.errors.length).toBeGreaterThanOrEqual(5) // id/name/version/entry/author
    }
  })

  test('非法 id 格式被拒绝', () => {
    for (const id of ['Bad ID', '-leading', 'UPPER', 'a']) {
      const result = validatePluginManifestObject(buildManifest({ id }))
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors.some(error => error.code === 'BAD_ID')).toBe(true)
      }
    }
  })

  test('id 与目录名不一致被拒绝', () => {
    const result = validatePluginManifestObject(buildManifest(), {
      directoryName: 'other-plugin'
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_ID')).toBe(true)
    }
  })

  test('非法 version 被拒绝', () => {
    const result = validatePluginManifestObject(buildManifest({ version: '1.0' }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_VERSION')).toBe(true)
    }
  })

  test('entry 包含路径穿越被拒绝', () => {
    for (const entry of ['../evil.js', '/absolute/path.js']) {
      const result = validatePluginManifestObject(buildManifest({ entry }))
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors.some(error => error.code === 'BAD_ENTRY')).toBe(true)
      }
    }
  })

  test('未知权限被拒绝', () => {
    const result = validatePluginManifestObject(
      buildManifest({ permissions: ['storage', 'filesystem-access'] })
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_PERMISSION')).toBe(true)
    }
  })

  test('未知事件订阅被拒绝', () => {
    const result = validatePluginManifestObject(buildManifest({ subscriptions: ['kernel:hook'] }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_SUBSCRIPTION')).toBe(true)
    }
  })

  test('select 设置项缺少 options 被拒绝', () => {
    const result = validatePluginManifestObject(
      buildManifest({ settings: [{ key: 'city', kind: 'select', label: '城市' }] })
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_SETTINGS')).toBe(true)
    }
  })

  test('托盘菜单项缺少 id 被拒绝', () => {
    const result = validatePluginManifestObject(buildManifest({ trayMenu: [{ label: '无 id' }] }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_TRAY_MENU')).toBe(true)
    }
  })

  test('声明 trayMenu 但无 trayMenu 权限被拒绝', () => {
    const result = validatePluginManifestObject(
      buildManifest({ trayMenu: [{ id: 'toggle', label: '切换' }] })
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_TRAY_MENU')).toBe(true)
    }
  })

  test('minAppVersion 不满足被拒绝', () => {
    const result = validatePluginManifestObject(buildManifest({ minAppVersion: '2.0.0' }), {
      appVersion: '1.6.0'
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'APP_VERSION_TOO_LOW')).toBe(true)
    }
  })

  test('minAppVersion 满足时通过', () => {
    const result = validatePluginManifestObject(buildManifest({ minAppVersion: '1.0.0' }), {
      appVersion: '1.6.0'
    })
    expect(result.valid).toBe(true)
  })
})

describe('validatePluginManifestFile', () => {
  let tempDirectory: string

  function writePlugin(id: string, manifest: Record<string, unknown>, withEntry = true) {
    const pluginDirectory = path.join(tempDirectory, id)
    fs.mkdirSync(pluginDirectory, { recursive: true })
    fs.writeFileSync(path.join(pluginDirectory, 'manifest.json'), JSON.stringify(manifest))
    if (withEntry) {
      fs.writeFileSync(path.join(pluginDirectory, 'index.js'), 'module.exports = () => {}')
    }
    return pluginDirectory
  }

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-validator-'))
  })

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  })

  test('合法插件目录通过校验', () => {
    const pluginDirectory = writePlugin('hello-plugin', buildManifest())
    const result = validatePluginManifestFile(pluginDirectory)
    expect(result.valid).toBe(true)
  })

  test('manifest.json 损坏时报 INVALID_JSON', () => {
    const pluginDirectory = path.join(tempDirectory, 'broken-plugin')
    fs.mkdirSync(pluginDirectory, { recursive: true })
    fs.writeFileSync(path.join(pluginDirectory, 'manifest.json'), '{invalid json')

    const result = validatePluginManifestFile(pluginDirectory)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors[0].code).toBe('INVALID_JSON')
    }
  })

  test('入口文件缺失时报 BAD_ENTRY', () => {
    const pluginDirectory = writePlugin('no-entry', buildManifest({ id: 'no-entry' }), false)
    const result = validatePluginManifestFile(pluginDirectory)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(error => error.code === 'BAD_ENTRY')).toBe(true)
    }
  })

  test('目录名与清单 id 不一致被拒绝', () => {
    const pluginDirectory = writePlugin('wrong-name', buildManifest({ id: 'right-name' }))
    const result = validatePluginManifestFile(pluginDirectory)
    expect(result.valid).toBe(false)
  })
})

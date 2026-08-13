/**
 * 插件脚手架测试
 * 验证 create-plugin.mjs 生成的插件目录可通过真实清单校验器，
 * 且非法 id / 已存在目录会被拒绝。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { validatePluginManifestFile } from '../electron/plugins/ManifestValidator'

const scriptPath = path.resolve(__dirname, '../scripts/create-plugin.mjs')

describe('create-plugin 脚手架', () => {
  let tempDirectory: string

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'))
  })

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  })

  test('生成的插件目录通过真实清单校验', () => {
    execFileSync('node', [scriptPath, 'weather-widget', tempDirectory], { stdio: 'pipe' })

    const pluginDirectory = path.join(tempDirectory, 'weather-widget')
    expect(fs.existsSync(path.join(pluginDirectory, 'manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDirectory, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDirectory, 'README.md'))).toBe(true)

    const validation = validatePluginManifestFile(pluginDirectory, { appVersion: '1.6.0' })
    expect(validation.valid).toBe(true)
  })

  test('非法插件 id 被拒绝', () => {
    expect(() =>
      execFileSync('node', [scriptPath, 'Bad ID', tempDirectory], { stdio: 'pipe' })
    ).toThrow()
  })

  test('已存在的非空目标目录被拒绝', () => {
    execFileSync('node', [scriptPath, 'weather-widget', tempDirectory], { stdio: 'pipe' })

    expect(() =>
      execFileSync('node', [scriptPath, 'weather-widget', tempDirectory], { stdio: 'pipe' })
    ).toThrow()
  })
})

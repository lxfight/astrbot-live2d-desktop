/**
 * 插件 SDK 包一致性测试
 * 构建 @astrbot/plugin-sdk 产物并验证与 src/shared 契约源码一致。
 * 发布 SDK 前改动 shared 类型/常量时必须保持本测试通过。
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  PLUGIN_API_VERSION,
  PLUGIN_DEFAULT_PERMISSIONS,
  PLUGIN_PERMISSION_VALID_VALUES,
  PLUGIN_EVENT_VALID_VALUES
} from '../src/shared/pluginManifest'
import { PLUGIN_ID_PATTERN, definePlugin } from '../src/shared/pluginSdk'

const require = createRequire(import.meta.url)
const sdkEntry = path.resolve(
  __dirname,
  '../packages/plugin-sdk/dist/packages/plugin-sdk/src/index.js'
)

let sdk: Record<string, unknown>

beforeAll(() => {
  execFileSync('node', [path.resolve(__dirname, '../scripts/build-plugin-sdk.mjs')], {
    stdio: 'pipe'
  })
  sdk = require(sdkEntry)
})

describe('plugin-sdk 产物与 shared 契约一致', () => {
  test('API 版本与权限/事件白名单一致', () => {
    expect(sdk.PLUGIN_API_VERSION).toBe(PLUGIN_API_VERSION)
    expect(sdk.PLUGIN_PERMISSION_VALID_VALUES).toEqual(PLUGIN_PERMISSION_VALID_VALUES)
    expect(sdk.PLUGIN_EVENT_VALID_VALUES).toEqual(PLUGIN_EVENT_VALID_VALUES)
    expect(sdk.PLUGIN_DEFAULT_PERMISSIONS).toEqual(PLUGIN_DEFAULT_PERMISSIONS)
  })

  test('插件 id 规则一致', () => {
    const sdkPattern = sdk.PLUGIN_ID_PATTERN as RegExp
    expect(sdkPattern.source).toBe(PLUGIN_ID_PATTERN.source)
    expect(sdkPattern.test('hello-plugin')).toBe(true)
    expect(sdkPattern.test('Bad ID')).toBe(false)
  })

  test('definePlugin 返回入口原样透传', () => {
    const sdkDefinePlugin = sdk.definePlugin as typeof definePlugin
    const entry = () => undefined
    expect(sdkDefinePlugin(entry)).toBe(entry)
  })
})

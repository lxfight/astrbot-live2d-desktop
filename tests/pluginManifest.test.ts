/**
 * pluginManifest 共享类型测试
 * 覆盖清单校验所需的常量与默认值
 */

import { describe, expect, test } from 'vitest'
import {
  PLUGIN_API_VERSION,
  PLUGIN_DEFAULT_PERMISSIONS,
  PLUGIN_EVENT_VALID_VALUES,
  PLUGIN_PERMISSION_VALID_VALUES
} from '../src/shared/pluginManifest'

describe('pluginManifest 常量', () => {
  test('API 版本遵循 semver 格式', () => {
    expect(PLUGIN_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('默认权限只包含 storage', () => {
    expect(PLUGIN_DEFAULT_PERMISSIONS).toEqual(['storage'])
  })

  test('默认权限在白名单内', () => {
    for (const permission of PLUGIN_DEFAULT_PERMISSIONS) {
      expect(PLUGIN_PERMISSION_VALID_VALUES).toContain(permission)
    }
  })

  test('权限与事件白名单无重复项', () => {
    expect(new Set(PLUGIN_PERMISSION_VALID_VALUES).size).toBe(PLUGIN_PERMISSION_VALID_VALUES.length)
    expect(new Set(PLUGIN_EVENT_VALID_VALUES).size).toBe(PLUGIN_EVENT_VALID_VALUES.length)
  })

  test('事件白名单覆盖四种核心事件', () => {
    expect(PLUGIN_EVENT_VALID_VALUES).toContain('message:received')
    expect(PLUGIN_EVENT_VALID_VALUES).toContain('message:sent')
    expect(PLUGIN_EVENT_VALID_VALUES).toContain('model:loaded')
    expect(PLUGIN_EVENT_VALID_VALUES).toContain('performance')
  })
})

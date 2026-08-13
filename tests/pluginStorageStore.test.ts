/**
 * PluginStorageStore 测试
 * 覆盖插件存储 CRUD、隔离性（跨插件不可见）、覆盖更新与清空
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { openSqliteDatabase, type AppSqliteDatabase } from '../electron/database/sqlite'
import { PluginStorageStore } from '../electron/database/PluginStorageStore'

let tempDirectory: string
let db: AppSqliteDatabase
let store: PluginStorageStore

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-storage-'))
  db = openSqliteDatabase(path.join(tempDirectory, 'test.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_storage (
      plugin_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (plugin_id, key)
    );
  `)
  store = new PluginStorageStore(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(tempDirectory, { recursive: true, force: true })
})

describe('PluginStorageStore', () => {
  test('setValue 后 getValue 返回 JSON 字符串', () => {
    store.setValue('weather', 'city', '{"name":"上海"}')
    expect(store.getValue('weather', 'city')).toBe('{"name":"上海"}')
  })

  test('未设置的键返回 null', () => {
    expect(store.getValue('weather', 'missing')).toBeNull()
  })

  test('不同插件的存储互相隔离', () => {
    store.setValue('weather', 'city', '上海')
    store.setValue('notes', 'city', '北京')

    expect(store.getValue('weather', 'city')).toBe('上海')
    expect(store.getValue('notes', 'city')).toBe('北京')
    expect(store.getKeys('weather')).toEqual(['city'])
    expect(store.getKeys('notes')).toEqual(['city'])
  })

  test('setValue 覆盖同名键并更新值', () => {
    store.setValue('weather', 'city', '旧值')
    store.setValue('weather', 'city', '新值')

    expect(store.getValue('weather', 'city')).toBe('新值')
    expect(store.getKeys('weather')).toEqual(['city'])
  })

  test('getKeys 按字母序返回', () => {
    store.setValue('weather', 'b-key', '1')
    store.setValue('weather', 'a-key', '2')
    store.setValue('weather', 'c-key', '3')

    expect(store.getKeys('weather')).toEqual(['a-key', 'b-key', 'c-key'])
  })

  test('removeValue 返回是否删除成功', () => {
    expect(store.removeValue('weather', 'missing')).toBe(false)

    store.setValue('weather', 'city', '上海')
    expect(store.removeValue('weather', 'city')).toBe(true)
    expect(store.getValue('weather', 'city')).toBeNull()
  })

  test('clear 只清空指定插件的存储', () => {
    store.setValue('weather', 'city', '上海')
    store.setValue('notes', 'title', '笔记')

    store.clear('weather')

    expect(store.getKeys('weather')).toEqual([])
    expect(store.getKeys('notes')).toEqual(['title'])
  })
})

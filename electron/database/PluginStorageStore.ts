/**
 * 插件存储（plugin_storage 表，schema v5）
 * 每个插件只能访问 plugin_id 等于自身 id 的行，宿主侧强制过滤。
 * 接收 AppSqliteDatabase 实例，独立于应用级数据库单例，便于单元测试。
 */

import type { AppSqliteDatabase } from './sqlite'

export class PluginStorageStore {
  constructor(private readonly db: AppSqliteDatabase) {}

  getValue(pluginId: string, key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM plugin_storage WHERE plugin_id = ? AND key = ?')
    const result = stmt.get(pluginId, key) as { value: string } | undefined
    return result ? result.value : null
  }

  getKeys(pluginId: string): string[] {
    const stmt = this.db.prepare('SELECT key FROM plugin_storage WHERE plugin_id = ? ORDER BY key')
    const rows = stmt.all(pluginId) as Array<{ key: string }>
    return rows.map(row => row.key)
  }

  setValue(pluginId: string, key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO plugin_storage (plugin_id, key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(plugin_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    stmt.run(pluginId, key, value, Date.now())
  }

  removeValue(pluginId: string, key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM plugin_storage WHERE plugin_id = ? AND key = ?')
    const result = stmt.run(pluginId, key)
    return Number(result.changes) > 0
  }

  /** 卸载插件时清空其全部存储 */
  clear(pluginId: string): void {
    const stmt = this.db.prepare('DELETE FROM plugin_storage WHERE plugin_id = ?')
    stmt.run(pluginId)
  }
}

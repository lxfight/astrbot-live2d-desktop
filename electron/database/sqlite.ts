import { DatabaseSync, type StatementSync } from 'node:sqlite'

/**
 * 基于 Node 内置 `node:sqlite` 的轻量数据库门面。
 *
 * API 对齐项目此前使用的 better-sqlite3 子集（prepare / exec / pragma /
 * transaction / close），使存储层无需任何原生模块：`node:sqlite` 随
 * Electron 捆绑的 Node 运行时提供，无预编译下载与 node-gyp 编译环节。
 *
 * 注意事项：
 * - 首次加载时 Node 可能打印一次 ExperimentalWarning（随 Node 版本演进会移除）。
 * - 整数字段默认以 number 返回；超出安全整数范围时请显式处理 bigint。
 */

export type SqliteParam = null | number | bigint | string | Uint8Array | DataView

export interface StatementRunResult {
  changes: number | bigint
  lastInsertRowid: number | bigint
}

export interface AppSqliteStatement {
  run(...params: SqliteParam[]): StatementRunResult
  get(...params: SqliteParam[]): Record<string, unknown> | undefined
  all(...params: SqliteParam[]): Record<string, unknown>[]
}

export interface AppSqliteDatabase {
  readonly open: boolean
  prepare(sql: string): AppSqliteStatement
  exec(sql: string): void
  pragma(source: string, options?: { simple?: boolean }): unknown
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult
  close(): void
}

/**
 * 预编译语句缓存上限。项目中 SQL 集合有限（动态 WHERE 组合也在可控范围内），
 * 超出上限时按插入顺序淘汰最早的条目。
 */
const STATEMENT_CACHE_LIMIT = 256

class NodeSqliteStatement implements AppSqliteStatement {
  constructor(private readonly statement: StatementSync) {}

  run(...params: SqliteParam[]): StatementRunResult {
    return this.statement.run(...params) as StatementRunResult
  }

  get(...params: SqliteParam[]): Record<string, unknown> | undefined {
    return this.statement.get(...params) as Record<string, unknown> | undefined
  }

  all(...params: SqliteParam[]): Record<string, unknown>[] {
    return this.statement.all(...params) as Record<string, unknown>[]
  }
}

class NodeSqliteDatabase implements AppSqliteDatabase {
  private readonly database: DatabaseSync
  private readonly statementCache = new Map<string, NodeSqliteStatement>()
  private isOpen = true

  constructor(dbPath: string) {
    this.database = new DatabaseSync(dbPath)
  }

  get open(): boolean {
    return this.isOpen
  }

  prepare(sql: string): AppSqliteStatement {
    const cached = this.statementCache.get(sql)
    if (cached) {
      return cached
    }

    if (this.statementCache.size >= STATEMENT_CACHE_LIMIT) {
      const oldestKey = this.statementCache.keys().next().value
      if (oldestKey !== undefined) {
        this.statementCache.delete(oldestKey)
      }
    }

    const statement = new NodeSqliteStatement(this.database.prepare(sql))
    this.statementCache.set(sql, statement)
    return statement
  }

  exec(sql: string): void {
    this.database.exec(sql)
  }

  pragma(source: string, options?: { simple?: boolean }): unknown {
    const sql = `PRAGMA ${source}`

    if (options?.simple) {
      const row = this.database.prepare(sql).get() as Record<string, unknown> | undefined
      if (!row) {
        return null
      }
      const [value] = Object.values(row)
      return value ?? null
    }

    this.database.exec(sql)
    return []
  }

  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      this.database.exec('BEGIN')
      try {
        const result = fn(...args)
        this.database.exec('COMMIT')
        return result
      } catch (error) {
        this.database.exec('ROLLBACK')
        throw error
      }
    }
  }

  close(): void {
    if (!this.isOpen) {
      return
    }
    this.statementCache.clear()
    this.database.close()
    this.isOpen = false
  }
}

export function openSqliteDatabase(dbPath: string): AppSqliteDatabase {
  return new NodeSqliteDatabase(dbPath)
}

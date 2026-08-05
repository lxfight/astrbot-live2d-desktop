import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { openSqliteDatabase, type AppSqliteDatabase } from '../electron/database/sqlite'

const tempDirs: string[] = []

function createDatabase(): AppSqliteDatabase {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-facade-'))
  tempDirs.push(dir)
  return openSqliteDatabase(path.join(dir, 'test.db'))
}

function createMessagesSchema(db: AppSqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      raw_text TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
  `)
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('sqlite facade', () => {
  it('runs CRUD with positional parameters', () => {
    const db = createDatabase()
    createMessagesSchema(db)

    const insert = db.prepare(
      'INSERT INTO messages (message_id, content, raw_text, timestamp) VALUES (?, ?, ?, ?)'
    )
    const runResult = insert.run('msg-1', '{"text":"hi"}', 'hi', 1000)
    expect(runResult.changes).toBe(1)
    expect(Number(runResult.lastInsertRowid)).toBeGreaterThan(0)

    const row = db
      .prepare('SELECT message_id, content, timestamp FROM messages WHERE message_id = ?')
      .get('msg-1')
    expect(row).toEqual({ message_id: 'msg-1', content: '{"text":"hi"}', timestamp: 1000 })

    const missing = db.prepare('SELECT * FROM messages WHERE message_id = ?').get('nope')
    expect(missing).toBeUndefined()

    db.prepare('UPDATE messages SET timestamp = ? WHERE message_id = ?').run(2000, 'msg-1')
    const allRows = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all()
    expect(allRows).toHaveLength(1)
    expect((allRows[0] as { timestamp: number }).timestamp).toBe(2000)

    const deleteResult = db.prepare('DELETE FROM messages WHERE message_id = ?').run('msg-1')
    expect(deleteResult.changes).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages').get()).toEqual({ count: 0 })

    db.close()
    expect(db.open).toBe(false)
  })

  it('reads and writes pragmas, including simple mode', () => {
    const db = createDatabase()

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('user_version = 7')

    expect(db.pragma('user_version', { simple: true })).toBe(7)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')

    db.close()
  })

  it('commits successful transactions', () => {
    const db = createDatabase()
    createMessagesSchema(db)

    const insertMany = db.transaction((count: number) => {
      const stmt = db.prepare(
        'INSERT INTO messages (message_id, content, raw_text, timestamp) VALUES (?, ?, ?, ?)'
      )
      for (let i = 0; i < count; i += 1) {
        stmt.run(`msg-${i}`, '{}', `text-${i}`, i)
      }
      return count
    })

    expect(insertMany(5)).toBe(5)
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages').get()).toEqual({ count: 5 })

    db.close()
  })

  it('rolls back failed transactions', () => {
    const db = createDatabase()
    createMessagesSchema(db)

    const failing = db.transaction(() => {
      db.prepare(
        'INSERT INTO messages (message_id, content, raw_text, timestamp) VALUES (?, ?, ?, ?)'
      ).run('msg-1', '{}', 'text', 1)
      throw new Error('boom')
    })

    expect(() => failing()).toThrow('boom')
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages').get()).toEqual({ count: 0 })

    db.close()
  })

  it('supports FTS5 tables with trigram tokenizer', () => {
    const db = createDatabase()
    createMessagesSchema(db)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        raw_text, content='messages', content_rowid='id', tokenize='trigram'
      );
      CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, raw_text) VALUES (new.id, COALESCE(new.raw_text, ''));
      END;
    `)

    db.prepare(
      'INSERT INTO messages (message_id, content, raw_text, timestamp) VALUES (?, ?, ?, ?)'
    ).run('msg-1', '{}', 'hello world 你好世界', 1)

    const matches = db
      .prepare(
        'SELECT id FROM messages WHERE id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)'
      )
      .all('"你好世界"')
    expect(matches).toHaveLength(1)

    db.prepare("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild')").run()

    db.close()
  })

  it('round-trips BLOB values', () => {
    const db = createDatabase()
    db.exec('CREATE TABLE IF NOT EXISTS blobs (id INTEGER PRIMARY KEY, data BLOB NOT NULL)')

    const payload = Buffer.from([1, 2, 3, 4, 5])
    db.prepare('INSERT INTO blobs (id, data) VALUES (?, ?)').run(1, payload)

    const row = db.prepare('SELECT data FROM blobs WHERE id = ?').get(1) as { data: Uint8Array }
    expect(Buffer.from(row.data).equals(payload)).toBe(true)

    db.close()
  })

  it('caches prepared statements per SQL string', () => {
    const db = createDatabase()
    createMessagesSchema(db)

    const first = db.prepare('SELECT COUNT(*) AS count FROM messages')
    const second = db.prepare('SELECT COUNT(*) AS count FROM messages')
    expect(first).toBe(second)

    db.close()
  })
})

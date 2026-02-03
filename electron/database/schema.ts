import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database | null = null

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'history.db')
  db = new Database(dbPath)

  // 启用 WAL 模式以提升性能
  db.pragma('journal_mode = WAL')

  // 创建表
  db.exec(`
    -- 消息表
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      message_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      raw_text TEXT,
      timestamp INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

    -- 表演记录表
    CREATE TABLE IF NOT EXISTS performances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      sequence TEXT NOT NULL,
      duration INTEGER,
      interrupted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_performances_message ON performances(message_id);

    -- 统计数据表
    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      hour INTEGER,
      message_count INTEGER DEFAULT 0,
      text_count INTEGER DEFAULT 0,
      image_count INTEGER DEFAULT 0,
      audio_count INTEGER DEFAULT 0,
      video_count INTEGER DEFAULT 0,
      motion_usage TEXT,
      expression_usage TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_statistics_date_hour ON statistics(date, hour);
  `)

  console.log('[数据库] 初始化完成:', dbPath)
  return db
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('数据库未初始化')
  }
  return db
}

/**
 * 关闭数据库
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[数据库] 已关闭')
  }
}

// 类型定义
export interface MessageRecord {
  messageId: string
  sessionId: string
  userId: string
  userName?: string
  messageType: 'friend' | 'group' | 'notify'
  direction: 'input' | 'output'
  content: any
  rawText?: string
  timestamp: number
}

export interface PerformanceRecord {
  messageId: string
  sequence: any[]
  duration?: number
  interrupted: boolean
}

export interface StatisticsData {
  date: string
  hour: number
  messageCount: number
  textCount: number
  imageCount: number
  audioCount: number
  videoCount: number
  motionUsage: Record<string, number>
  expressionUsage: Record<string, number>
}

/**
 * 保存消息记录
 */
export function saveMessage(record: MessageRecord): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO messages (
      message_id, session_id, user_id, user_name,
      message_type, direction, content, raw_text, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    record.messageId,
    record.sessionId,
    record.userId,
    record.userName || null,
    record.messageType,
    record.direction,
    JSON.stringify(record.content),
    record.rawText || null,
    record.timestamp
  )
}

/**
 * 保存表演记录
 */
export function savePerformance(record: PerformanceRecord): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO performances (message_id, sequence, duration, interrupted)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(
    record.messageId,
    JSON.stringify(record.sequence),
    record.duration || null,
    record.interrupted ? 1 : 0
  )
}

/**
 * 查询消息历史
 */
export function getMessages(options: {
  limit?: number
  offset?: number
  startDate?: number
  endDate?: number
  messageType?: string
  direction?: string
  keyword?: string
}): any[] {
  const db = getDatabase()
  let sql = 'SELECT * FROM messages WHERE 1=1'
  const params: any[] = []

  if (options.startDate) {
    sql += ' AND timestamp >= ?'
    params.push(options.startDate)
  }

  if (options.endDate) {
    sql += ' AND timestamp <= ?'
    params.push(options.endDate)
  }

  if (options.messageType) {
    sql += ' AND message_type = ?'
    params.push(options.messageType)
  }

  if (options.direction) {
    sql += ' AND direction = ?'
    params.push(options.direction)
  }

  if (options.keyword) {
    sql += ' AND raw_text LIKE ?'
    params.push(`%${options.keyword}%`)
  }

  sql += ' ORDER BY timestamp ASC'

  if (options.limit) {
    sql += ' LIMIT ?'
    params.push(options.limit)
  }

  if (options.offset) {
    sql += ' OFFSET ?'
    params.push(options.offset)
  }

  const stmt = db.prepare(sql)
  return stmt.all(...params)
}

/**
 * 更新统计数据
 */
export function updateStatistics(data: StatisticsData): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO statistics (
      date, hour, message_count, text_count, image_count,
      audio_count, video_count, motion_usage, expression_usage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, hour) DO UPDATE SET
      message_count = message_count + excluded.message_count,
      text_count = text_count + excluded.text_count,
      image_count = image_count + excluded.image_count,
      audio_count = audio_count + excluded.audio_count,
      video_count = video_count + excluded.video_count,
      motion_usage = excluded.motion_usage,
      expression_usage = excluded.expression_usage,
      updated_at = CURRENT_TIMESTAMP
  `)

  stmt.run(
    data.date,
    data.hour,
    data.messageCount,
    data.textCount,
    data.imageCount,
    data.audioCount,
    data.videoCount,
    JSON.stringify(data.motionUsage),
    JSON.stringify(data.expressionUsage)
  )
}

/**
 * 获取统计数据
 */
export function getStatistics(startDate: string, endDate: string): any[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM statistics
    WHERE date BETWEEN ? AND ?
    ORDER BY date, hour
  `)

  return stmt.all(startDate, endDate)
}

/**
 * 获取消息总数
 */
export function getMessagesCount(options: {
  startDate?: number
  endDate?: number
  messageType?: string
  direction?: string
  keyword?: string
}): number {
  const db = getDatabase()
  let sql = 'SELECT COUNT(*) as count FROM messages WHERE 1=1'
  const params: any[] = []

  if (options.startDate) {
    sql += ' AND timestamp >= ?'
    params.push(options.startDate)
  }

  if (options.endDate) {
    sql += ' AND timestamp <= ?'
    params.push(options.endDate)
  }

  if (options.messageType) {
    sql += ' AND message_type = ?'
    params.push(options.messageType)
  }

  if (options.direction) {
    sql += ' AND direction = ?'
    params.push(options.direction)
  }

  if (options.keyword) {
    sql += ' AND raw_text LIKE ?'
    params.push(`%${options.keyword}%`)
  }

  const stmt = db.prepare(sql)
  const result = stmt.get(...params) as any
  return result.count
}

/**
 * 清空历史记录
 */
export function clearHistory(): void {
  const db = getDatabase()
  db.exec(`
    DELETE FROM performances;
    DELETE FROM messages;
    DELETE FROM statistics;
    VACUUM;
  `)
  console.log('[数据库] 历史记录已清空')
}

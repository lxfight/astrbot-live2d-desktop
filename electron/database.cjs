const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { createLogger } = require('./logger.cjs');

const logger = createLogger('[数据库]');
let db = null;

// 初始化数据库
function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'conversations.db');

  logger.info('初始化数据库:', dbPath);
  db = new Database(dbPath);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 创建表
  createTables();

  // 创建默认对话（如果不存在）
  createDefaultConversation();

  return db;
}

// 创建数据表
function createTables() {
  // 对话会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0
    )
  `);

  // 消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content TEXT,
      raw_data TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  `);

  // 统计信息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_date TEXT NOT NULL UNIQUE,
      total_messages INTEGER DEFAULT 0,
      user_messages INTEGER DEFAULT 0,
      ai_messages INTEGER DEFAULT 0,
      text_messages INTEGER DEFAULT 0,
      image_messages INTEGER DEFAULT 0,
      voice_messages INTEGER DEFAULT 0,
      total_duration INTEGER DEFAULT 0,
      session_count INTEGER DEFAULT 0
    )
  `);

  logger.info('数据表创建完成');
}

// 创建默认对话
function createDefaultConversation() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM conversations').get();

  if (existing.count === 0) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO conversations (title, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?)
    `).run('默认对话', now, now, 1);

    logger.info('创建默认对话');
  }
}

// ========== 对话操作 ==========

// 获取所有对话
function getAllConversations() {
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
}

// 获取激活的对话
function getActiveConversation() {
  return db.prepare('SELECT * FROM conversations WHERE is_active = 1').get();
}

// 创建新对话
function createConversation(title) {
  const now = Date.now();

  // 取消所有对话的激活状态
  db.prepare('UPDATE conversations SET is_active = 0').run();

  const result = db.prepare(`
    INSERT INTO conversations (title, created_at, updated_at, is_active)
    VALUES (?, ?, ?, 1)
  `).run(title || '新对话', now, now);

  return result.lastInsertRowid;
}

// 切换激活对话
function setActiveConversation(conversationId) {
  db.prepare('UPDATE conversations SET is_active = 0').run();
  db.prepare('UPDATE conversations SET is_active = 1 WHERE id = ?').run(conversationId);
}

// 更新对话标题
function updateConversationTitle(conversationId, title) {
  db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conversationId);
}

// 删除对话（级联删除消息）
function deleteConversation(conversationId) {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
}

// ========== 消息操作 ==========

// 保存消息
function saveMessage(params) {
  const { conversation_id, sender, message_type, content, raw_data, timestamp } = params;

  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender, message_type, content, raw_data, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(conversation_id, sender, message_type, content, raw_data, timestamp);

  // 更新对话的消息计数和更新时间
  db.prepare(`
    UPDATE conversations
    SET message_count = message_count + 1, updated_at = ?
    WHERE id = ?
  `).run(timestamp, conversation_id);

  return result.lastInsertRowid;
}

// 获取对话的消息列表（支持分页）
function getMessages(conversationId, limit = 50, offset = 0) {
  return db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `).all(conversationId, limit, offset);
}

// 获取对话的消息总数
function getMessageCount(conversationId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
  `).get(conversationId);

  return result.count;
}

// 删除指定消息
function deleteMessage(messageId) {
  const message = db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(messageId);

  if (message) {
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);

    // 更新对话的消息计数
    db.prepare(`
      UPDATE conversations
      SET message_count = message_count - 1
      WHERE id = ?
    `).run(message.conversation_id);
  }
}

// ========== 统计操作 ==========

// 更新统计数据
function updateStatistics(params) {
  const { stat_date, ...updates } = params;

  // 构建更新语句
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ${key} + ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  // 插入或更新
  db.prepare(`
    INSERT INTO statistics (stat_date, ${Object.keys(updates).join(', ')})
    VALUES (?, ${Object.keys(updates).map(() => '?').join(', ')})
    ON CONFLICT(stat_date) DO UPDATE SET ${fields.join(', ')}
  `).run(stat_date, ...Object.values(updates), ...values);
}

// 获取统计数据（支持日期范围）
function getStatistics(startDate, endDate) {
  if (startDate && endDate) {
    return db.prepare(`
      SELECT * FROM statistics
      WHERE stat_date BETWEEN ? AND ?
      ORDER BY stat_date DESC
    `).all(startDate, endDate);
  }

  return db.prepare('SELECT * FROM statistics ORDER BY stat_date DESC').all();
}

// 获取总统计
function getTotalStatistics() {
  const stats = db.prepare(`
    SELECT
      SUM(total_messages) as total_messages,
      SUM(user_messages) as user_messages,
      SUM(ai_messages) as ai_messages,
      SUM(text_messages) as text_messages,
      SUM(image_messages) as image_messages,
      SUM(voice_messages) as voice_messages,
      SUM(total_duration) as total_duration,
      SUM(session_count) as session_count
    FROM statistics
  `).get();

  return stats || {
    total_messages: 0,
    user_messages: 0,
    ai_messages: 0,
    text_messages: 0,
    image_messages: 0,
    voice_messages: 0,
    total_duration: 0,
    session_count: 0
  };
}

// 关闭数据库
function closeDatabase() {
  if (db) {
    db.close();
    logger.info('已关闭');
  }
}

module.exports = {
  initDatabase,
  closeDatabase,

  // 对话操作
  getAllConversations,
  getActiveConversation,
  createConversation,
  setActiveConversation,
  updateConversationTitle,
  deleteConversation,

  // 消息操作
  saveMessage,
  getMessages,
  getMessageCount,
  deleteMessage,

  // 统计操作
  updateStatistics,
  getStatistics,
  getTotalStatistics
};

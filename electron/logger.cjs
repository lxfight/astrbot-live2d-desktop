/**
 * Electron 主进程日志工具
 * 提供统一的日志接口，支持日志级别、时间戳、前缀
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(prefix = '[Electron]') {
    this.prefix = prefix;
    this.level = process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
  }

  _log(level, levelName, ...args) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const message = `${timestamp} ${this.prefix} [${levelName}]`;

    switch (level) {
      case LOG_LEVELS.DEBUG:
      case LOG_LEVELS.INFO:
        console.log(message, ...args);
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, ...args);
        break;
      case LOG_LEVELS.ERROR:
        console.error(message, ...args);
        break;
    }
  }

  debug(...args) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', ...args);
  }

  info(...args) {
    this._log(LOG_LEVELS.INFO, 'INFO', ...args);
  }

  warn(...args) {
    this._log(LOG_LEVELS.WARN, 'WARN', ...args);
  }

  error(...args) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', ...args);
  }

  /**
   * 创建子日志器（带自定义前缀）
   */
  child(prefix) {
    return new Logger(`${this.prefix}${prefix}`);
  }
}

// 导出默认日志器和子日志器工厂
const logger = new Logger();

module.exports = {
  logger,
  createLogger: (prefix) => new Logger(prefix)
};

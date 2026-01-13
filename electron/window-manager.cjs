const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;
let messageDetailWindow = null;
let pendingMessageData = null;

/**
 * 创建窗口的通用配置
 */
function getCommonWebPreferences() {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.cjs')
  };
}

/**
 * 加载窗口 URL（开发/生产环境）
 */
function loadWindowURL(window, hash = '') {
  if (process.env.NODE_ENV === 'development') {
    const url = hash ? `http://localhost:1420/#/${hash}` : 'http://localhost:1420';
    window.loadURL(url);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: hash || undefined
    });
  }
}

/**
 * 设置开发环境 CSP
 */
function setupDevCSP(window) {
  if (process.env.NODE_ENV === 'development') {
    window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' http://localhost:1420;" +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:1420;" +
            "style-src 'self' 'unsafe-inline' http://localhost:1420;" +
            "img-src 'self' data: blob: http://localhost:1420;" +
            "connect-src 'self' ws://localhost:* wss://*;"
          ]
        }
      });
    });
  }
}

/**
 * 创建主窗口
 */
function createMainWindow(store, getMergedSettings) {
  const settings = getMergedSettings();

  const { workArea } = screen.getPrimaryDisplay();

  const windowSize = settings.windowSize || { width: 400, height: 600 };
  const width = Math.min(Math.max(320, Number(windowSize.width) || 400), workArea.width);
  const height = Math.min(Math.max(320, Number(windowSize.height) || 600), workArea.height);

  let x = workArea.x + workArea.width - width - 40;
  let y = workArea.y + workArea.height - height - 80;
  if (settings.windowPosition && typeof settings.windowPosition.x === 'number' && typeof settings.windowPosition.y === 'number') {
    x = Math.round(settings.windowPosition.x);
    y = Math.round(settings.windowPosition.y);
  }

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: settings.transparent,
    backgroundColor: '#00000000',
    focusable: false,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    webPreferences: getCommonWebPreferences()
  });

  const persistBounds = () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const s = store.get('settings', {});
    s.windowPosition = { x: bounds.x, y: bounds.y };
    s.windowSize = { width: bounds.width, height: bounds.height };
    store.set('settings', s);
  };
  mainWindow.on('moved', persistBounds);
  mainWindow.on('resize', persistBounds);

  setupDevCSP(mainWindow);
  loadWindowURL(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * 创建设置窗口
 */
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    minWidth: 900,
    minHeight: 650,
    webPreferences: getCommonWebPreferences()
  });

  loadWindowURL(settingsWindow, 'settings');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

/**
 * 创建消息详情窗口
 */
function createMessageDetailWindow(messageData) {
  if (messageDetailWindow) {
    messageDetailWindow.focus();
    return messageDetailWindow;
  }

  pendingMessageData = messageData;

  messageDetailWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    webPreferences: getCommonWebPreferences()
  });

  loadWindowURL(messageDetailWindow, 'message-detail');

  messageDetailWindow.on('closed', () => {
    messageDetailWindow = null;
    pendingMessageData = null;
  });

  return messageDetailWindow;
}

/**
 * 获取窗口引用
 */
function getMainWindow() {
  return mainWindow;
}

function getSettingsWindow() {
  return settingsWindow;
}

function getMessageDetailWindow() {
  return messageDetailWindow;
}

function getPendingMessageData() {
  return pendingMessageData;
}

module.exports = {
  createMainWindow,
  createSettingsWindow,
  createMessageDetailWindow,
  getMainWindow,
  getSettingsWindow,
  getMessageDetailWindow,
  getPendingMessageData
};

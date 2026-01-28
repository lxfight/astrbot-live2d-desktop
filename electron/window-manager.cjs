const { BrowserWindow, screen } = require('electron');
const path = require('path');
const activeWin = require('active-win');

let mainWindow = null;
let settingsWindow = null;
let messageDetailWindow = null;
let pendingMessageData = null;

// 游戏模式相关变量
let gameModeTimer = null;
let isHidden = false;
let lastWindowCheck = 0;
let lastGameModeInterval = null;

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

  const windowSize = settings.windowSize || { width: 280, height: 350 };
  const width = Math.min(Math.max(200, Number(windowSize.width) || 280), workArea.width);
  const height = Math.min(Math.max(200, Number(windowSize.height) || 350), workArea.height);

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

  // 游戏模式：全屏检测
  updateGameMode(mainWindow, store, settings);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (gameModeTimer) {
      clearInterval(gameModeTimer);
      gameModeTimer = null;
    }
    isHidden = false;
    lastGameModeInterval = null;
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
    // Use custom frame (frameless) for custom UI
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    minWidth: 900,
    minHeight: 650,
    webPreferences: getCommonWebPreferences(),
    titleBarStyle: 'hidden', // Add this for better OS integration if needed, or just keep frame: false
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
    frame: true,
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

/**
 * 设置游戏模式（全屏检测）
 */
function setupGameMode(window, store, mergedSettings = {}) {
  const checkIntervalRaw = mergedSettings.fullscreenHideTimeout ?? store.get('settings', {})?.fullscreenHideTimeout;
  const checkInterval = Math.max(1000, Number(checkIntervalRaw) || 3000);

  // 定期检查是否有全屏应用
  gameModeTimer = setInterval(() => {
    checkFullscreenAndHide(window, store);
  }, checkInterval);
  lastGameModeInterval = checkInterval;
}

/**
 * 更新游戏模式（启用/停用/更新检测间隔）
 * 说明：以前游戏模式只在主窗口创建时读取一次配置；保存设置后不会生效。
 * 这里让其在 set-settings 后也能实时生效，避免“原本能检测现在不能”的错觉/回归。
 */
function updateGameMode(window, store, mergedSettings = {}) {
  if (!window || window.isDestroyed()) return;

  const enabled = mergedSettings.gameMode !== false;
  const checkIntervalRaw = mergedSettings.fullscreenHideTimeout ?? store.get('settings', {})?.fullscreenHideTimeout;
  const nextInterval = Math.max(1000, Number(checkIntervalRaw) || 3000);

  if (!enabled) {
    if (gameModeTimer) {
      clearInterval(gameModeTimer);
      gameModeTimer = null;
    }
    lastGameModeInterval = null;
    if (isHidden) {
      window.show();
      isHidden = false;
    }
    return;
  }

  // Enabled: ensure timer is running with the latest interval.
  if (gameModeTimer && lastGameModeInterval === nextInterval) return;
  if (gameModeTimer) {
    clearInterval(gameModeTimer);
    gameModeTimer = null;
  }
  setupGameMode(window, store, { ...mergedSettings, fullscreenHideTimeout: nextInterval });
}

/**
 * 检查全屏状态并隐藏窗口
 */
async function checkFullscreenAndHide(window, store) {
  if (!window || window.isDestroyed()) return;

  const now = Date.now();
  if (now - lastWindowCheck < 1000) return; // 防止频繁检查
  lastWindowCheck = now;

  try {
    // 使用 active-win 获取当前活动窗口信息
    const activeWindow = await activeWin();

    if (!activeWindow) {
      // 无法获取活动窗口信息，保持当前状态
      return;
    }

    const displays = screen.getAllDisplays();
    let hasFullscreen = false;

    // 检查活动窗口是否为全屏应用
    for (const display of displays) {
      const displayBounds = display.bounds;
      const winBounds = activeWindow.bounds;

      // 检查窗口是否覆盖了整个显示器
      const widthDiff = Math.abs(winBounds.width - displayBounds.width);
      const heightDiff = Math.abs(winBounds.height - displayBounds.height);
      const posDiffX = Math.abs(winBounds.x - displayBounds.x);
      const posDiffY = Math.abs(winBounds.y - displayBounds.y);

      // 如果窗口尺寸接近全屏且位置对齐，认为是全屏应用
      // 允许一定误差：宽度10px，高度50px（考虑任务栏），位置10px
      if (widthDiff < 10 && heightDiff < 50 && posDiffX < 10 && posDiffY < 10) {
        // 排除自己的窗口：用 PID 更可靠，避免误伤其他 Electron 应用或误判导致永远不隐藏。
        const isOwnWindow =
          (activeWindow.owner && activeWindow.owner.processId === process.pid) ||
          (activeWindow.title && activeWindow.title.includes('AstrBot'));

        if (!isOwnWindow) {
          hasFullscreen = true;
          console.log(`[游戏模式] 检测到全屏应用: ${activeWindow.title} (${activeWindow.owner.name})`);
          break;
        }
      }
    }

    // 根据全屏状态显示或隐藏窗口
    if (hasFullscreen && !isHidden) {
      // 有全屏应用，隐藏Live2D窗口
      window.hide();
      isHidden = true;
      console.log('[游戏模式] 隐藏Live2D窗口');
    } else if (!hasFullscreen && isHidden) {
      // 没有全屏应用，根据设置决定是否自动显示窗口
      const settings = store.get('settings', {});
      const autoRestore = settings.gameModeAutoRestore !== false; // 默认为 true

      if (autoRestore) {
        window.show();
        isHidden = false;
        console.log('[游戏模式] 显示Live2D窗口');
      } else {
        console.log('[游戏模式] 全屏退出，但自动恢复已禁用');
      }
    }
  } catch (error) {
    console.error('[游戏模式] 全屏检测失败:', error);
  }
}

/**
 * 手动显示窗口（供快捷键使用）
 */
function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    isHidden = false;
  }
}

module.exports = {
  createMainWindow,
  createSettingsWindow,
  createMessageDetailWindow,
  getMainWindow,
  getSettingsWindow,
  getMessageDetailWindow,
  getPendingMessageData,
  showMainWindow,
  updateGameMode
};

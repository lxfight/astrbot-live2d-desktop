const { app, BrowserWindow } = require('electron');
const Store = require('electron-store');
const db = require('./database.cjs');
const windowManager = require('./window-manager.cjs');
const trayManager = require('./tray-manager.cjs');
const shortcutManager = require('./shortcut-manager.cjs');
const ipcHandlers = require('./ipc-handlers.cjs');

const store = new Store();

const DEVTOOLS_AUTOFILL_MESSAGES = [
  'Autofill.enable',
  'Autofill.setAddresses'
];

app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (event, _level, message, _line, sourceId) => {
    if (!sourceId || !sourceId.startsWith('devtools://')) {
      return;
    }
    if (DEVTOOLS_AUTOFILL_MESSAGES.some((keyword) => String(message).includes(keyword))) {
      event.preventDefault();
    }
  });
});

// 默认设置
const defaultSettings = {
  wsUrl: 'ws://localhost:9090/astrbot/live2d',
  token: '',
  alwaysOnTop: false,
  transparent: true,
  modelScale: 1.0,
  modelX: 0,
  modelY: 0,
  windowSize: { width: 280, height: 350 }, // 优化为更合理的桌面宠物尺寸
  windowPosition: null,
  gameMode: true, // 默认启用游戏模式
  fullscreenHideTimeout: 3000 // 全屏检测超时（毫秒）
};

/**
 * 获取合并后的设置
 */
function getMergedSettings() {
  const stored = store.get('settings', {}) || {};
  const merged = { ...defaultSettings, ...stored };

  // 配置迁移：旧版本默认值升级（仅执行一次）
  const migrationVersion = store.get('migrationVersion', 0);
  if (migrationVersion < 1) {
    if (merged.wsUrl === 'ws://localhost:9090/ws' && merged.token === 'secret') {
      merged.wsUrl = defaultSettings.wsUrl;
      merged.token = defaultSettings.token;
      store.set('settings', { ...stored, wsUrl: merged.wsUrl, token: merged.token });
    }
    store.set('migrationVersion', 1);
  }

  return merged;
}

/**
 * 应用初始化
 */
app.whenReady().then(() => {
  db.initDatabase();

  const mainWindow = windowManager.createMainWindow(store, getMergedSettings);

  const tray = trayManager.createTray(
    mainWindow,
    store,
    windowManager.createSettingsWindow
  );

  shortcutManager.registerGlobalShortcuts(
    mainWindow,
    windowManager.getSettingsWindow(),
    getMergedSettings
  );

  shortcutManager.setupShortcutRelease(mainWindow, getMergedSettings);

  ipcHandlers.registerIPCHandlers(
    store,
    getMergedSettings,
    windowManager.getMainWindow,
    windowManager.getSettingsWindow,
    windowManager.createSettingsWindow,
    windowManager.createMessageDetailWindow,
    windowManager.getPendingMessageData,
    () => shortcutManager.registerGlobalShortcuts(
      windowManager.getMainWindow(),
      windowManager.getSettingsWindow(),
      getMergedSettings
    ),
    (connected) => trayManager.updateConnectionStatus(
      connected,
      windowManager.getMainWindow(),
      store,
      windowManager.createSettingsWindow
    ),
    db
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow(store, getMergedSettings);
    }
  });
});

/**
 * 应用退出处理
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db.closeDatabase();
  trayManager.destroyTray();
  shortcutManager.cleanupShortcuts();
});

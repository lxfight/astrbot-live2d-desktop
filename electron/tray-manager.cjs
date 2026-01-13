const { Tray, Menu, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger.cjs');

const logger = createLogger('[托盘]');
let tray = null;
let isConnected = false;

/**
 * 构建托盘菜单（动态更新状态）
 */
function buildTrayMenu(mainWindow, store, createSettingsWindow) {
  const isWindowVisible = mainWindow && mainWindow.isVisible();
  const isAlwaysOnTop = store.get('settings.alwaysOnTop', false);

  return Menu.buildFromTemplate([
    {
      label: isConnected ? '● 已连接' : '○ 未连接',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isWindowVisible ? '隐藏窗口' : '显示窗口',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
          if (tray) {
            tray.setContextMenu(buildTrayMenu(mainWindow, store, createSettingsWindow));
          }
        }
      }
    },
    {
      label: '窗口置顶',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: (item) => {
        const settings = store.get('settings', {});
        settings.alwaysOnTop = item.checked;
        store.set('settings', settings);
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(item.checked);
        }
      }
    },
    { type: 'separator' },
    {
      label: '打开设置',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        app.quit();
      }
    }
  ]);
}

/**
 * 创建系统托盘
 */
function createTray(mainWindow, store, createSettingsWindow) {
  const iconPath = path.join(__dirname, '../public/icon.png');

  if (!fs.existsSync(iconPath)) {
    logger.warn('托盘图标文件不存在，跳过创建托盘');
    return null;
  }

  tray = new Tray(iconPath);
  tray.setToolTip('AstrBot Live2D 桌面');

  tray.setContextMenu(buildTrayMenu(mainWindow, store, createSettingsWindow));

  tray.on('right-click', () => {
    tray.setContextMenu(buildTrayMenu(mainWindow, store, createSettingsWindow));
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
      tray.setContextMenu(buildTrayMenu(mainWindow, store, createSettingsWindow));
    }
  });

  return tray;
}

/**
 * 更新连接状态
 */
function updateConnectionStatus(connected, mainWindow, store, createSettingsWindow) {
  isConnected = connected;
  logger.info(`连接状态更新: ${connected ? '已连接' : '未连接'}`);

  if (tray) {
    tray.setContextMenu(buildTrayMenu(mainWindow, store, createSettingsWindow));
  }
}

/**
 * 销毁托盘
 */
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * 获取托盘引用
 */
function getTray() {
  return tray;
}

module.exports = {
  createTray,
  updateConnectionStatus,
  destroyTray,
  getTray
};

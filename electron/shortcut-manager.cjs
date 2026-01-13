const { globalShortcut } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { createLogger } = require('./logger.cjs');

const logger = createLogger('[快捷键]');
let isRecording = false;
let currentPressedKeys = new Set();
let uiohookStarted = false;

/**
 * 将 Electron 快捷键字符串转换为 uiohook-napi 键码
 */
function parseHotkeyToKeycodes(hotkey) {
  const keys = hotkey.split('+').map(k => k.trim());
  const keycodes = [];

  const keyMap = {
    // 修饰键
    'CommandOrControl': process.platform === 'darwin' ? UiohookKey.Cmd : UiohookKey.Ctrl,
    'Command': UiohookKey.Cmd,
    'Cmd': UiohookKey.Cmd,
    'Control': UiohookKey.Ctrl,
    'Ctrl': UiohookKey.Ctrl,
    'Alt': UiohookKey.Alt,
    'Option': UiohookKey.Alt,
    'Shift': UiohookKey.Shift,
    'Super': UiohookKey.Meta,

    // 字母键
    'A': UiohookKey.A, 'B': UiohookKey.B, 'C': UiohookKey.C, 'D': UiohookKey.D,
    'E': UiohookKey.E, 'F': UiohookKey.F, 'G': UiohookKey.G, 'H': UiohookKey.H,
    'I': UiohookKey.I, 'J': UiohookKey.J, 'K': UiohookKey.K, 'L': UiohookKey.L,
    'M': UiohookKey.M, 'N': UiohookKey.N, 'O': UiohookKey.O, 'P': UiohookKey.P,
    'Q': UiohookKey.Q, 'R': UiohookKey.R, 'S': UiohookKey.S, 'T': UiohookKey.T,
    'U': UiohookKey.U, 'V': UiohookKey.V, 'W': UiohookKey.W, 'X': UiohookKey.X,
    'Y': UiohookKey.Y, 'Z': UiohookKey.Z,

    // 数字键
    '0': UiohookKey.Digit0, '1': UiohookKey.Digit1, '2': UiohookKey.Digit2,
    '3': UiohookKey.Digit3, '4': UiohookKey.Digit4, '5': UiohookKey.Digit5,
    '6': UiohookKey.Digit6, '7': UiohookKey.Digit7, '8': UiohookKey.Digit8,
    '9': UiohookKey.Digit9,

    // 功能键
    'F1': UiohookKey.F1, 'F2': UiohookKey.F2, 'F3': UiohookKey.F3, 'F4': UiohookKey.F4,
    'F5': UiohookKey.F5, 'F6': UiohookKey.F6, 'F7': UiohookKey.F7, 'F8': UiohookKey.F8,
    'F9': UiohookKey.F9, 'F10': UiohookKey.F10, 'F11': UiohookKey.F11, 'F12': UiohookKey.F12,

    // 其他键
    'Space': UiohookKey.Space,
    'Tab': UiohookKey.Tab,
    'Enter': UiohookKey.Enter,
    'Escape': UiohookKey.Escape,
    'Backspace': UiohookKey.Backspace,
    'Delete': UiohookKey.Delete,
    'Insert': UiohookKey.Insert,
    'Home': UiohookKey.Home,
    'End': UiohookKey.End,
    'PageUp': UiohookKey.PageUp,
    'PageDown': UiohookKey.PageDown,
    'ArrowUp': UiohookKey.ArrowUp,
    'ArrowDown': UiohookKey.ArrowDown,
    'ArrowLeft': UiohookKey.ArrowLeft,
    'ArrowRight': UiohookKey.ArrowRight,
  };

  for (const key of keys) {
    const upperKey = key.toUpperCase();
    const code = keyMap[key] || keyMap[upperKey];
    if (code !== undefined) {
      keycodes.push(code);
    } else {
      logger.warn(`未知的按键: ${key}`);
    }
  }

  return keycodes;
}

/**
 * 注册全局快捷键
 */
function registerGlobalShortcuts(mainWindow, settingsWindow, getMergedSettings) {
  globalShortcut.unregisterAll();

  const settings = getMergedSettings();
  const hotkey = settings.recordHotkey || 'CommandOrControl+T';

  try {
    const ret = globalShortcut.register(hotkey, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      if (!isRecording) {
        isRecording = true;
        mainWindow.webContents.send('start-recording');
        logger.info('开始录音');
      }
    });

    if (!ret) {
      logger.error(`注册失败，可能与其他应用冲突: ${hotkey}`);
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('hotkey-conflict', hotkey);
      }
      return false;
    } else {
      logger.info(`注册成功: ${hotkey}`);
      return true;
    }
  } catch (error) {
    logger.error('注册错误:', error);
    return false;
  }
}

/**
 * 设置快捷键释放监听
 */
function setupShortcutRelease(mainWindow, getMergedSettings) {
  if (uiohookStarted) {
    return;
  }

  try {
    uIOhook.on('keydown', (event) => {
      currentPressedKeys.add(event.keycode);
    });

    uIOhook.on('keyup', (event) => {
      currentPressedKeys.delete(event.keycode);

      if (isRecording) {
        const settings = getMergedSettings();
        const hotkey = settings.recordHotkey || 'CommandOrControl+T';
        const requiredKeys = parseHotkeyToKeycodes(hotkey);

        const allReleased = requiredKeys.every(keycode => !currentPressedKeys.has(keycode));

        if (allReleased) {
          isRecording = false;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stop-recording');
            logger.info('检测到按键释放，停止录音');
          }
        }
      }
    });

    uIOhook.start();
    uiohookStarted = true;
    logger.info('键盘监听已启动');
  } catch (error) {
    logger.error('启动键盘监听失败:', error);
  }
}

/**
 * 清理快捷键资源
 */
function cleanupShortcuts() {
  if (uiohookStarted) {
    try {
      uIOhook.stop();
      logger.info('键盘监听已停止');
    } catch (error) {
      logger.error('停止键盘监听失败:', error);
    }
  }

  globalShortcut.unregisterAll();
}

module.exports = {
  registerGlobalShortcuts,
  setupShortcutRelease,
  cleanupShortcuts
};

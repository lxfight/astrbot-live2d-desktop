const { ipcMain, dialog, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger.cjs');

const logger = createLogger('[IPC]');

/**
 * 注册所有 IPC 处理器
 */
function registerIPCHandlers(
  store,
  getMergedSettings,
  getMainWindow,
  getSettingsWindow,
  createSettingsWindow,
  createMessageDetailWindow,
  getPendingMessageData,
  registerGlobalShortcuts,
  updateConnectionStatus,
  db
) {
  // ========== 设置管理 ==========
  ipcMain.handle('get-settings', () => {
    return getMergedSettings();
  });

  ipcMain.handle('set-settings', (event, settings) => {
    store.set('settings', settings);

    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (settings.alwaysOnTop !== undefined) {
        mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
      }
    }

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send('settings-changed', settings);
      }
    });

    if (settings.recordHotkey !== undefined) {
      const success = registerGlobalShortcuts();
      return { success, conflict: !success };
    }

    return { success: true };
  });

  ipcMain.handle('set-window-flag', (event, flag, value) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    switch (flag) {
      case 'alwaysOnTop':
        mainWindow.setAlwaysOnTop(value);
        break;
      case 'transparent':
        // 透明度需要重启窗口
        break;
    }
  });

  // ========== 窗口控制 ==========
  ipcMain.handle('set-window-focusable', (event, focusable) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { success: false };

    try {
      mainWindow.setFocusable(!!focusable);
      if (focusable) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        mainWindow.blur();
      }
      return { success: true };
    } catch (error) {
      logger.error('设置窗口聚焦失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { success: false };

    try {
      if (ignore) {
        const forward = !!options?.forward;
        mainWindow.setIgnoreMouseEvents(true, forward ? { forward: true } : undefined);
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
      return { success: true };
    } catch (error) {
      logger.error('设置鼠标穿透失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-settings', () => {
    createSettingsWindow();
    return { success: true };
  });

  ipcMain.handle('hide-window', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.hide();
    }
    return { success: true };
  });

  ipcMain.handle('get-window-position', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { x: 0, y: 0 };
    const bounds = mainWindow.getBounds();
    return { x: bounds.x, y: bounds.y };
  });

  ipcMain.handle('get-cursor-position', () => {
    return screen.getCursorScreenPoint();
  });

  ipcMain.handle('set-window-position', (event, x, y) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { success: false };

    try {
      mainWindow.setPosition(Math.round(x), Math.round(y));

      const settings = store.get('settings', {});
      settings.windowPosition = { x, y };
      store.set('settings', settings);

      return { success: true };
    } catch (error) {
      logger.error('设置窗口位置失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-window-size', (event, width, height) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { success: false };

    try {
      const nextWidth = Math.max(1, Math.round(width));
      const nextHeight = Math.max(1, Math.round(height));
      mainWindow.setSize(nextWidth, nextHeight);

      const settings = store.get('settings', {});
      settings.windowSize = { width: nextWidth, height: nextHeight };
      store.set('settings', settings);

      return { success: true };
    } catch (error) {
      logger.error('设置窗口大小失败:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 模型管理 ==========
  ipcMain.handle('select-model-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Live2D 模型文件夹'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, folderPath: result.filePaths[0] };
  });

  ipcMain.handle('validate-model', async (event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return { valid: false, error: '文件夹不存在' };
      }

      const files = fs.readdirSync(folderPath);

      const modelConfigFile = files.find(f => f === 'model3.json' || f === 'model.json');
      if (!modelConfigFile) {
        return { valid: false, error: '未找到 model3.json 或 model.json 配置文件' };
      }

      const configPath = path.join(folderPath, modelConfigFile);
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      const mocFile = configData.FileReferences?.Moc;
      if (!mocFile) {
        return { valid: false, error: '配置文件中未指定 Moc 文件' };
      }

      const mocPath = path.join(folderPath, mocFile);
      if (!fs.existsSync(mocPath)) {
        return { valid: false, error: `Moc 文件不存在: ${mocFile}` };
      }

      const textures = configData.FileReferences?.Textures || [];
      if (textures.length === 0) {
        return { valid: false, error: '配置文件中未指定纹理文件' };
      }

      const textureExists = textures.some(tex => {
        const texPath = path.join(folderPath, tex);
        return fs.existsSync(texPath);
      });

      if (!textureExists) {
        return { valid: false, error: '纹理文件不存在' };
      }

      const motions = configData.FileReferences?.Motions || configData.Motions || {};
      const motionCount = Object.values(motions).reduce((sum, arr) => sum + arr.length, 0);

      if (motionCount === 0) {
        return { valid: false, error: '模型未包含任何动作' };
      }

      return {
        valid: true,
        modelName: path.basename(folderPath),
        configFile: modelConfigFile,
        version: configData.Version || 3,
        textureCount: textures.length,
        motionCount
      };
    } catch (error) {
      return { valid: false, error: `验证失败: ${error.message}` };
    }
  });

  ipcMain.handle('get-available-models', async () => {
    try {
      const publicModelsPath = path.join(__dirname, '../public/models');
      const distModelsPath = path.join(__dirname, '../dist/models');

      let modelsPath = publicModelsPath;
      if (!fs.existsSync(publicModelsPath) && fs.existsSync(distModelsPath)) {
        modelsPath = distModelsPath;
      }

      if (!fs.existsSync(modelsPath)) {
        return { success: true, models: [] };
      }

      const folders = fs.readdirSync(modelsPath).filter(name => {
        const fullPath = path.join(modelsPath, name);
        return fs.statSync(fullPath).isDirectory();
      });

      const models = folders.map(name => ({
        name,
        path: `/models/${name}`,
        isDeletable: name !== 'default'
      }));

      return { success: true, models };
    } catch (error) {
      logger.error('获取模型列表失败:', error);
      return { success: false, error: error.message, models: [] };
    }
  });

  ipcMain.handle('import-model', async (event, sourcePath, targetName) => {
    try {
      const publicModelsPath = path.join(__dirname, '../public/models');
      const distModelsPath = path.join(__dirname, '../dist/models');

      let modelsPath = publicModelsPath;
      if (!fs.existsSync(publicModelsPath)) {
        if (fs.existsSync(distModelsPath)) {
          modelsPath = distModelsPath;
        } else {
          fs.mkdirSync(publicModelsPath, { recursive: true });
          modelsPath = publicModelsPath;
        }
      }

      const targetPath = path.join(modelsPath, targetName);

      if (fs.existsSync(targetPath)) {
        return { success: false, error: '同名模型已存在' };
      }

      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      copyRecursive(sourcePath, targetPath);

      return { success: true, modelPath: `/models/${targetName}` };
    } catch (error) {
      logger.error('导入模型失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-model', async (event, modelName) => {
    try {
      if (modelName === 'default') {
        return { success: false, error: '无法删除默认模型' };
      }

      const publicModelsPath = path.join(__dirname, '../public/models', modelName);
      const distModelsPath = path.join(__dirname, '../dist/models', modelName);

      let deleted = false;

      if (fs.existsSync(publicModelsPath)) {
        fs.rmSync(publicModelsPath, { recursive: true, force: true });
        deleted = true;
      }

      if (fs.existsSync(distModelsPath)) {
        fs.rmSync(distModelsPath, { recursive: true, force: true });
        deleted = true;
      }

      if (!deleted) {
        return { success: false, error: '模型不存在' };
      }

      return { success: true };
    } catch (error) {
      logger.error('删除模型失败:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 动作和表情预览 ==========
  ipcMain.handle('preview-motion', async (event, group, index) => {
    logger.debug(`预览动作: ${group} #${index}`);

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('play-motion', group, index);
      return { success: true };
    }

    logger.error('主窗口未打开');
    return { success: false, error: '主窗口未打开' };
  });

  ipcMain.handle('preview-expression', async (event, expressionId) => {
    logger.debug(`预览表情: ${expressionId}`);

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('play-expression', expressionId);
      return { success: true };
    }

    logger.error('主窗口未打开');
    return { success: false, error: '主窗口未打开' };
  });

  // ========== 连接状态更新 ==========
  ipcMain.on('update-connection-status', (event, connected) => {
    logger.info(`连接状态更新: ${connected ? '已连接' : '未连接'}`);
    updateConnectionStatus(connected);
  });

  // ========== 消息详情窗口 ==========
  ipcMain.handle('open-message-detail', (event, messageData) => {
    logger.debug('打开消息详情窗口');
    createMessageDetailWindow(messageData);
    return { success: true };
  });

  ipcMain.handle('get-message-detail-data', () => {
    logger.debug('获取消息详情数据');
    return getPendingMessageData();
  });

  ipcMain.handle('close-message-detail', () => {
    logger.debug('关闭消息详情窗口');
    const messageDetailWindow = require('./window-manager.cjs').getMessageDetailWindow();
    if (messageDetailWindow) {
      messageDetailWindow.close();
    }
    return { success: true };
  });

  // ========== 数据库操作 ==========
  registerDatabaseHandlers(db);
}

/**
 * 注册数据库相关 IPC 处理器
 */
function registerDatabaseHandlers(db) {
  const handlers = {
    'db-get-conversations': () => db.getAllConversations(),
    'db-get-active-conversation': () => db.getActiveConversation(),
    'db-create-conversation': (event, title) => db.createConversation(title),
    'db-set-active-conversation': (event, conversationId) => {
      db.setActiveConversation(conversationId);
      return { success: true };
    },
    'db-update-conversation-title': (event, conversationId, title) => {
      db.updateConversationTitle(conversationId, title);
      return { success: true };
    },
    'db-delete-conversation': (event, conversationId) => {
      db.deleteConversation(conversationId);
      return { success: true };
    },
    'db-save-message': (event, params) => db.saveMessage(params),
    'db-get-messages': (event, conversationId, limit, offset) => db.getMessages(conversationId, limit, offset),
    'db-get-message-count': (event, conversationId) => db.getMessageCount(conversationId),
    'db-delete-message': (event, messageId) => {
      db.deleteMessage(messageId);
      return { success: true };
    },
    'db-update-statistics': (event, params) => {
      db.updateStatistics(params);
      return { success: true };
    },
    'db-get-statistics': (event, startDate, endDate) => db.getStatistics(startDate, endDate),
    'db-get-total-statistics': () => db.getTotalStatistics()
  };

  Object.entries(handlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler);
  });
}

module.exports = {
  registerIPCHandlers
};

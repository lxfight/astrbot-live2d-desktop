const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 设置管理
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  setWindowFlag: (flag, value) => ipcRenderer.invoke('set-window-flag', flag, value),

  // 鼠标穿透控制
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),

  // 窗口控制
  showSettings: () => ipcRenderer.invoke('show-settings'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),

  // 窗口位置控制
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('set-window-position', x, y),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),

  // 窗口大小控制
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),

  // 窗口聚焦控制
  setWindowFocusable: (focusable) => ipcRenderer.invoke('set-window-focusable', focusable),

  // 事件监听（返回清理函数）
  onSettingsChanged: (callback) => {
    const handler = (event, settings) => callback(settings)
    ipcRenderer.on('settings-changed', handler)
    return () => ipcRenderer.removeListener('settings-changed', handler)
  },

  // 模型管理
  selectModelFolder: () => ipcRenderer.invoke('select-model-folder'),
  validateModel: (folderPath) => ipcRenderer.invoke('validate-model', folderPath),
  importModel: (sourcePath, targetName) => ipcRenderer.invoke('import-model', sourcePath, targetName),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  deleteModel: (modelName) => ipcRenderer.invoke('delete-model', modelName),

  // 动作和表情预览
  previewMotion: (group, index) => ipcRenderer.invoke('preview-motion', group, index),
  previewExpression: (expressionId) => ipcRenderer.invoke('preview-expression', expressionId),

  // 接收主窗口的播放指令（返回清理函数）
  onPlayMotion: (callback) => {
    const handler = (event, group, index) => callback(group, index)
    ipcRenderer.on('play-motion', handler)
    return () => ipcRenderer.removeListener('play-motion', handler)
  },
  onPlayExpression: (callback) => {
    const handler = (event, expressionId) => callback(expressionId)
    ipcRenderer.on('play-expression', handler)
    return () => ipcRenderer.removeListener('play-expression', handler)
  },

  // 更新连接状态
  updateConnectionStatus: (connected) => ipcRenderer.send('update-connection-status', connected),

  // 全局快捷键录音（返回清理函数）
  onStartRecording: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('start-recording', handler)
    return () => ipcRenderer.removeListener('start-recording', handler)
  },
  onStopRecording: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('stop-recording', handler)
    return () => ipcRenderer.removeListener('stop-recording', handler)
  },

  // 快捷键冲突通知（返回清理函数）
  onHotkeyConflict: (callback) => {
    const handler = (event, hotkey) => callback(hotkey)
    ipcRenderer.on('hotkey-conflict', handler)
    return () => ipcRenderer.removeListener('hotkey-conflict', handler)
  },

  // 消息详情窗口
  openMessageDetail: (messageData) => ipcRenderer.invoke('open-message-detail', messageData),
  getMessageDetailData: () => ipcRenderer.invoke('get-message-detail-data'),
  closeMessageDetail: () => ipcRenderer.invoke('close-message-detail'),

  // 数据库操作 - 对话管理
  dbGetConversations: () => ipcRenderer.invoke('db-get-conversations'),
  dbGetActiveConversation: () => ipcRenderer.invoke('db-get-active-conversation'),
  dbCreateConversation: (title) => ipcRenderer.invoke('db-create-conversation', title),
  dbSetActiveConversation: (conversationId) => ipcRenderer.invoke('db-set-active-conversation', conversationId),
  dbUpdateConversationTitle: (conversationId, title) => ipcRenderer.invoke('db-update-conversation-title', conversationId, title),
  dbDeleteConversation: (conversationId) => ipcRenderer.invoke('db-delete-conversation', conversationId),

  // 数据库操作 - 消息管理
  dbSaveMessage: (params) => ipcRenderer.invoke('db-save-message', params),
  dbGetMessages: (conversationId, limit, offset) => ipcRenderer.invoke('db-get-messages', conversationId, limit, offset),
  dbGetMessageCount: (conversationId) => ipcRenderer.invoke('db-get-message-count', conversationId),
  dbDeleteMessage: (messageId) => ipcRenderer.invoke('db-delete-message', messageId),

  // 数据库操作 - 统计信息
  dbUpdateStatistics: (params) => ipcRenderer.invoke('db-update-statistics', params),
  dbGetStatistics: (startDate, endDate) => ipcRenderer.invoke('db-get-statistics', startDate, endDate),
  dbGetTotalStatistics: () => ipcRenderer.invoke('db-get-total-statistics')
});


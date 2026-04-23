const { contextBridge, ipcRenderer } = require('electron')

function subscribeIpc<T extends unknown[]>(channel: string, callback: (...args: T) => void) {
  const listener = (_event: unknown, ...args: T) => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

function normalizeRendererLogArg(arg: any): string {
  if (typeof arg === 'string') {
    return arg
  }

  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`
  }

  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function sendRendererLog(level: 'debug' | 'info' | 'warn' | 'error', args: any[]): void {
  try {
    const fileName = window.location.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/i, '')
    const sourceLabel = fileName
      ? `renderer:${fileName}`
      : window.location.hash
        ? `renderer${window.location.hash}`
        : 'renderer'
    ipcRenderer.send('log:renderer', {
      level,
      source: sourceLabel,
      args: args.map((item) => normalizeRendererLogArg(item))
    })
  } catch {
    // ignore ipc log failure to avoid affecting business flow
  }
}

/**
 * 暴露给渲染进程的 API
 */
contextBridge.exposeInMainWorld('electron', {
  // 连接管理
  bridge: {
    getSession: () => ipcRenderer.invoke('bridge:getSession'),
    sendMessage: (payload: any) => ipcRenderer.invoke('bridge:sendMessage', payload),
    sendTouch: (x: number, y: number, action: string) => ipcRenderer.invoke('bridge:sendTouch', x, y, action),
    sendState: (op: string, payload: any) => ipcRenderer.invoke('bridge:sendState', op, payload),

    onPerformShow: (callback: (payload: any) => void) => subscribeIpc('perform:show', callback),
    onPerformInterrupt: (callback: () => void) => subscribeIpc('perform:interrupt', callback)
  },

  bridgeLifecycle: {
    getSnapshot: () => ipcRenderer.invoke('bridgeLifecycle:getSnapshot'),
    connect: () => ipcRenderer.invoke('bridgeLifecycle:connect'),
    disconnect: () => ipcRenderer.invoke('bridgeLifecycle:disconnect'),
    onStateChanged: (callback: (snapshot: any) => void) => subscribeIpc('bridgeLifecycle:stateChanged', callback),
  },

  // 窗口管理
  window: {
    openSettings: (page?: string) => ipcRenderer.invoke('window:openSettings', page),
    closeSettings: () => ipcRenderer.invoke('window:closeSettings'),
    minimizeCurrent: () => ipcRenderer.invoke('window:minimizeCurrent'),
    toggleMaximizeCurrent: () => ipcRenderer.invoke('window:toggleMaximizeCurrent'),
    isMaximizedCurrent: () => ipcRenderer.invoke('window:isMaximizedCurrent'),
    closeCurrent: () => ipcRenderer.invoke('window:closeCurrent'),
    notifyRendererReady: (windowKind: string) => ipcRenderer.invoke('window:notifyRendererReady', windowKind),
    closeWelcome: () => ipcRenderer.invoke('window:closeWelcome'),
    getScreenshotSettings: () => ipcRenderer.invoke('window:getScreenshotSettings'),
    updateScreenshotSettings: (settings: any) => ipcRenderer.invoke('window:updateScreenshotSettings', settings),
    onMaximizedChanged: (callback: (maximized: boolean) => void) => subscribeIpc('window:maximizedChanged', callback),
    openExternal: (url: string) => ipcRenderer.invoke('window:openExternal', url),
    openResource: (source: string, suggestedName?: string) => ipcRenderer.invoke('window:openResource', source, suggestedName),
    saveResource: (source: string, suggestedName?: string) => ipcRenderer.invoke('window:saveResource', source, suggestedName),
    getAppVersion: () => ipcRenderer.invoke('window:getAppVersion'),
    getPlatformCapabilities: () => ipcRenderer.invoke('window:getPlatformCapabilities'),
    
    // 窗口事件监听
    startWatching: () => ipcRenderer.invoke('window:startWatching'),
    getActiveWindow: () => ipcRenderer.invoke('window:getActiveWindow'),
    getWindowHistory: () => ipcRenderer.invoke('window:getWindowHistory'),
    getAllWindows: () => ipcRenderer.invoke('window:getAllWindows'),
    buildAIContext: () => ipcRenderer.invoke('window:buildAIContext'),
    getWatcherConfig: () => ipcRenderer.invoke('window:getWatcherConfig'),
    updateWatcherConfig: (config: any) => ipcRenderer.invoke('window:updateWatcherConfig', config),
    resetWatcherConfig: () => ipcRenderer.invoke('window:resetWatcherConfig'),
    onWindowEvent: (callback: (event: any) => void) => {
      const listener = (_event: any, event: any) => callback(event)
      ipcRenderer.on('window:event', listener)
      // 返回取消订阅函数
      return () => ipcRenderer.removeListener('window:event', listener)
    }
  },

  desktopBehavior: {
    getPreferences: () => ipcRenderer.invoke('desktopBehavior:getPreferences'),
    updatePreferences: (config: any) => ipcRenderer.invoke('desktopBehavior:updatePreferences', config),
    getSnapshot: () => ipcRenderer.invoke('desktopBehavior:getSnapshot'),
    setMousePassthrough: (ignoreMouseEvents: boolean) => ipcRenderer.invoke('desktopBehavior:setMousePassthrough', ignoreMouseEvents),
    setModelReady: (ready: boolean) => ipcRenderer.invoke('desktopBehavior:setModelReady', ready),
    requestReveal: (reason?: string) => ipcRenderer.invoke('desktopBehavior:requestReveal', reason),
    onSnapshotChanged: (callback: (snapshot: any) => void) => subscribeIpc('desktopBehavior:snapshotChanged', callback),
  },

  // 设置窗口专用
  settings: {
    getPendingPage: () => ipcRenderer.invoke('settings:getPendingPage'),
    onNavigateTo: (callback: (page: string) => void) => {
      return subscribeIpc('settings:navigateTo', callback)
    }
  },

  // 用户配置
  user: {
    setUserName: (name: string) => ipcRenderer.invoke('user:setUserName', name),
    getUserName: () => ipcRenderer.invoke('user:getUserName'),
    getUserId: () => ipcRenderer.invoke('user:getUserId')
  },

  // 连接配置（主进程持久化）
  connectionSettings: {
    load: () => ipcRenderer.invoke('connectionSettings:load'),
    save: (payload: any) => ipcRenderer.invoke('connectionSettings:save', payload),
    migrateLegacy: (rawLegacyJson: string) => ipcRenderer.invoke('connectionSettings:migrateLegacy', rawLegacyJson),
    onChanged: (callback: (event: any) => void) => subscribeIpc('connectionSettings:changed', callback),
  },

  connectionBehaviorSettings: {
    load: () => ipcRenderer.invoke('connectionBehaviorSettings:load'),
    save: (payload: any) => ipcRenderer.invoke('connectionBehaviorSettings:save', payload),
    migrateLegacy: (rawLegacyJson: string) => ipcRenderer.invoke('connectionBehaviorSettings:migrateLegacy', rawLegacyJson),
    onChanged: (callback: (event: any) => void) => subscribeIpc('connectionBehaviorSettings:changed', callback),
  },

  // 历史记录
  history: {
    getMessages: (options: any) => ipcRenderer.invoke('history:getMessages', options),
    saveMessage: (record: any) => ipcRenderer.invoke('history:saveMessage', record),
    savePerformance: (record: any) => ipcRenderer.invoke('history:savePerformance', record),
    updateStatistics: (data: any) => ipcRenderer.invoke('history:updateStatistics', data),
    getStatistics: (startDate: string, endDate: string) => ipcRenderer.invoke('history:getStatistics', startDate, endDate),
    getAverageResponseTime: (startDate: number, endDate: number) => ipcRenderer.invoke('history:getAverageResponseTime', startDate, endDate),
    clearHistory: () => ipcRenderer.invoke('history:clearHistory')
  },

  // 模型管理
  model: {
    selectFolder: () => ipcRenderer.invoke('model:selectFolder'),
    import: (sourcePath: string, modelName: string) => ipcRenderer.invoke('model:import', sourcePath, modelName),
    getList: () => ipcRenderer.invoke('model:getList'),
    delete: (modelName: string) => ipcRenderer.invoke('model:delete', modelName),
    load: (modelPath: string) => ipcRenderer.invoke('model:load', modelPath),
    onLoad: (callback: (modelPath: string) => void) => {
      return subscribeIpc('model:load', callback)
    }
  },

  // 全局快捷键
  shortcut: {
    register: (accelerator: string) => ipcRenderer.invoke('shortcut:register', accelerator),
    unregister: () => ipcRenderer.invoke('shortcut:unregister'),
    isRegistered: (accelerator: string) => ipcRenderer.invoke('shortcut:isRegistered', accelerator),
    setRecordingState: (recording: boolean) => ipcRenderer.invoke('shortcut:setRecordingState', recording),
    onRecordingStart: (callback: () => void) => subscribeIpc('shortcut:recording-start', callback),
    onRecordingStop: (callback: () => void) => subscribeIpc('shortcut:recording-stop', callback)
  },

  // 日志
  log: {
    debug: (...args: any[]) => sendRendererLog('debug', args),
    info: (...args: any[]) => sendRendererLog('info', args),
    warn: (...args: any[]) => sendRendererLog('warn', args),
    error: (...args: any[]) => sendRendererLog('error', args),
    getDirectory: () => ipcRenderer.invoke('log:getDirectory'),
    openDirectory: () => ipcRenderer.invoke('log:openDirectory'),
    setLevel: (level: 'info' | 'debug') => ipcRenderer.invoke('log:setLevel', level),
    getConfig: () => ipcRenderer.invoke('log:getConfig')
  },

  // 自动更新
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    getState: () => ipcRenderer.invoke('update:getState'),
    getSettings: () => ipcRenderer.invoke('update:getSettings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('update:updateSettings', settings),
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    onStateChanged: (callback: (state: any) => void) => subscribeIpc('update:stateChanged', callback)
  }
})

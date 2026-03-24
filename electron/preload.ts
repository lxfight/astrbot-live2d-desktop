const { contextBridge, ipcRenderer } = require('electron')

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
    const sourceLabel = window.location.hash
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
    connect: (url: string, token?: string) => ipcRenderer.invoke('bridge:connect', url, token),
    disconnect: () => ipcRenderer.invoke('bridge:disconnect'),
    isConnected: () => ipcRenderer.invoke('bridge:isConnected'),
    getSession: () => ipcRenderer.invoke('bridge:getSession'),
    sendMessage: (payload: any) => ipcRenderer.invoke('bridge:sendMessage', payload),
    sendTouch: (x: number, y: number, action: string) => ipcRenderer.invoke('bridge:sendTouch', x, y, action),
    sendState: (op: string, payload: any) => ipcRenderer.invoke('bridge:sendState', op, payload),

    // 事件监听
    onConnected: (callback: (payload: any) => void) => {
      ipcRenderer.on('bridge:connected', (_event: any, payload: any) => callback(payload))
    },
    onDisconnected: (callback: (info: any) => void) => {
      ipcRenderer.on('bridge:disconnected', (_event: any, info: any) => callback(info))
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('bridge:error', (_event: any, error: any) => callback(error))
    },
    onPerformShow: (callback: (payload: any) => void) => {
      ipcRenderer.on('perform:show', (_event: any, payload: any) => callback(payload))
    },
    onPerformInterrupt: (callback: () => void) => {
      ipcRenderer.on('perform:interrupt', () => callback())
    }
  },

  // 窗口管理
  window: {
    openSettings: (page?: string) => ipcRenderer.invoke('window:openSettings', page),
    closeSettings: () => ipcRenderer.invoke('window:closeSettings'),
    minimizeCurrent: () => ipcRenderer.invoke('window:minimizeCurrent'),
    toggleMaximizeCurrent: () => ipcRenderer.invoke('window:toggleMaximizeCurrent'),
    isMaximizedCurrent: () => ipcRenderer.invoke('window:isMaximizedCurrent'),
    closeCurrent: () => ipcRenderer.invoke('window:closeCurrent'),
    openHistory: () => ipcRenderer.invoke('window:openHistory'),
    closeHistory: () => ipcRenderer.invoke('window:closeHistory'),
    closeWelcome: () => ipcRenderer.invoke('window:closeWelcome'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    getAlwaysOnTop: () => ipcRenderer.invoke('window:getAlwaysOnTop'),
    refreshAlwaysOnTop: () => ipcRenderer.invoke('window:refreshAlwaysOnTop'),
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.invoke('window:setIgnoreMouseEvents', ignore),
    setSize: (width: number, height: number) => ipcRenderer.invoke('window:setSize', width, height),
    resetSize: () => ipcRenderer.invoke('window:resetSize'),
    getPassThroughMode: () => ipcRenderer.invoke('window:getPassThroughMode'),
    onPassThroughModeChanged: (callback: (enabled: boolean) => void) => {
      ipcRenderer.removeAllListeners('window:passThroughModeChanged')
      ipcRenderer.on('window:passThroughModeChanged', (_event: any, enabled: boolean) => callback(enabled))
    },
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      ipcRenderer.removeAllListeners('window:maximizedChanged')
      ipcRenderer.on('window:maximizedChanged', (_event: any, maximized: boolean) => callback(maximized))
    },
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

  // 设置窗口专用
  settings: {
    getPendingPage: () => ipcRenderer.invoke('settings:getPendingPage'),
    onNavigateTo: (callback: (page: string) => void) => {
      // 移除之前的监听器，避免重复
      ipcRenderer.removeListener('settings:navigateTo', callback as any)
      ipcRenderer.on('settings:navigateTo', (_event: any, page: string) => callback(page))
    }
  },

  // 用户配置
  user: {
    setUserName: (name: string) => ipcRenderer.invoke('user:setUserName', name),
    getUserName: () => ipcRenderer.invoke('user:getUserName'),
    getUserId: () => ipcRenderer.invoke('user:getUserId')
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
      // 移除旧的监听器，避免重复
      ipcRenderer.removeAllListeners('model:load')
      ipcRenderer.on('model:load', (_event: any, modelPath: string) => callback(modelPath))
    }
  },

  // 全局快捷键
  shortcut: {
    register: (accelerator: string) => ipcRenderer.invoke('shortcut:register', accelerator),
    unregister: () => ipcRenderer.invoke('shortcut:unregister'),
    isRegistered: (accelerator: string) => ipcRenderer.invoke('shortcut:isRegistered', accelerator),
    onRecordingStart: (callback: () => void) => {
      ipcRenderer.removeAllListeners('shortcut:recording-start')
      ipcRenderer.on('shortcut:recording-start', () => callback())
    },
    onRecordingStop: (callback: () => void) => {
      ipcRenderer.removeAllListeners('shortcut:recording-stop')
      ipcRenderer.on('shortcut:recording-stop', () => callback())
    }
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
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    onStateChanged: (callback: (state: any) => void) => {
      ipcRenderer.removeAllListeners('update:stateChanged')
      ipcRenderer.on('update:stateChanged', (_event: any, state: any) => callback(state))
    }
  }
})

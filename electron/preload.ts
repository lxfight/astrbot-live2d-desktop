const { contextBridge, ipcRenderer } = require('electron')

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
      ipcRenderer.on('bridge:connected', (event, payload) => callback(payload))
    },
    onDisconnected: (callback: (info: any) => void) => {
      ipcRenderer.on('bridge:disconnected', (event, info) => callback(info))
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('bridge:error', (event, error) => callback(error))
    },
    onPerformShow: (callback: (payload: any) => void) => {
      ipcRenderer.on('perform:show', (event, payload) => callback(payload))
    },
    onPerformInterrupt: (callback: () => void) => {
      ipcRenderer.on('perform:interrupt', () => callback())
    }
  },

  // 窗口管理
  window: {
    openSettings: () => ipcRenderer.invoke('window:openSettings'),
    closeSettings: () => ipcRenderer.invoke('window:closeSettings'),
    openHistory: () => ipcRenderer.invoke('window:openHistory'),
    closeHistory: () => ipcRenderer.invoke('window:closeHistory'),
    closeWelcome: () => ipcRenderer.invoke('window:closeWelcome'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.invoke('window:setIgnoreMouseEvents', ignore),
    onPassThroughModeChanged: (callback: (enabled: boolean) => void) => {
      ipcRenderer.removeAllListeners('window:passThroughModeChanged')
      ipcRenderer.on('window:passThroughModeChanged', (event, enabled) => callback(enabled))
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
    clearHistory: () => ipcRenderer.invoke('history:clearHistory')
  },

  // 模型管理
  model: {
    selectFile: () => ipcRenderer.invoke('model:selectFile'),
    import: (sourcePath: string, modelName: string) => ipcRenderer.invoke('model:import', sourcePath, modelName),
    getList: () => ipcRenderer.invoke('model:getList'),
    delete: (modelName: string) => ipcRenderer.invoke('model:delete', modelName),
    load: (modelPath: string) => ipcRenderer.invoke('model:load', modelPath),
    onLoad: (callback: (modelPath: string) => void) => {
      // 移除旧的监听器，避免重复
      ipcRenderer.removeAllListeners('model:load')
      ipcRenderer.on('model:load', (event, modelPath) => callback(modelPath))
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
  }
})


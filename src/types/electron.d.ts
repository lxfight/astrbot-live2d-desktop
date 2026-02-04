// TypeScript 类型声明
declare global {
  interface Window {
    electron: {
      bridge: {
        connect: (url: string, token?: string) => Promise<{ success: boolean; error?: string }>
        disconnect: () => Promise<{ success: boolean; error?: string }>
        isConnected: () => Promise<boolean>
        getSession: () => Promise<{ sessionId: string; userId: string } | null>
        sendMessage: (payload: any) => Promise<{ success: boolean; error?: string }>
        sendTouch: (x: number, y: number, action: string) => Promise<{ success: boolean; error?: string }>
        sendState: (op: string, payload: any) => Promise<{ success: boolean; error?: string }>
        onConnected: (callback: (payload: any) => void) => void
        onDisconnected: (callback: (info: any) => void) => void
        onError: (callback: (error: any) => void) => void
        onPerformShow: (callback: (payload: any) => void) => void
        onPerformInterrupt: (callback: () => void) => void
      }
      window: {
        openSettings: () => Promise<{ success: boolean }>
        closeSettings: () => Promise<{ success: boolean }>
        openHistory: () => Promise<{ success: boolean }>
        closeHistory: () => Promise<{ success: boolean }>
        closeWelcome: () => Promise<{ success: boolean }>
        setAlwaysOnTop: (flag: boolean) => Promise<{ success: boolean }>
        setIgnoreMouseEvents: (ignore: boolean) => Promise<{ success: boolean }>
        onPassThroughModeChanged: (callback: (enabled: boolean) => void) => void
      }
      user: {
        setUserName: (name: string) => Promise<{ success: boolean }>
        getUserName: () => Promise<string | null>
        getUserId: () => Promise<string>
      }
      history: {
        getMessages: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
        saveMessage: (record: any) => Promise<{ success: boolean; error?: string }>
        savePerformance: (record: any) => Promise<{ success: boolean; error?: string }>
        updateStatistics: (data: any) => Promise<{ success: boolean; error?: string }>
        getStatistics: (startDate: string, endDate: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        clearHistory: () => Promise<{ success: boolean; error?: string }>
      }
      model: {
        selectFile: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
        import: (sourcePath: string, modelName: string) => Promise<{ success: boolean; modelPath?: string; error?: string }>
        getList: () => Promise<{ success: boolean; models?: Array<{ name: string; path: string }>; error?: string }>
        delete: (modelName: string) => Promise<{ success: boolean; error?: string }>
        load: (modelPath: string) => Promise<{ success: boolean; error?: string }>
        onLoad: (callback: (modelPath: string) => void) => void
      }
      shortcut: {
        register: (accelerator: string) => Promise<{ success: boolean; error?: string }>
        unregister: () => Promise<{ success: boolean; error?: string }>
        isRegistered: (accelerator: string) => Promise<boolean>
        onRecordingStart: (callback: () => void) => void
        onRecordingStop: (callback: () => void) => void
      }
    }
  }
}

export {}

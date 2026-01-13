/**
 * Vitest 测试环境设置
 */

import { vi } from 'vitest'

// Mock Electron API
globalThis.window = global.window as any

if (!window.electronAPI) {
  window.electronAPI = {
    // Settings
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    onSettingsChanged: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setWindowPosition: vi.fn(),
    setWindowSize: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),

    // Database
    getAllConversations: vi.fn(),
    getConversationById: vi.fn(),
    createConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    deleteConversation: vi.fn(),
    setActiveConversation: vi.fn(),
    getActiveConversation: vi.fn(),
    saveMessage: vi.fn(),
    getMessagesByConversation: vi.fn(),
    getMessageById: vi.fn(),
    deleteMessage: vi.fn(),
    searchMessages: vi.fn(),
    getDailyStatistics: vi.fn(),
    getStatisticsRange: vi.fn(),
    updateStatistics: vi.fn(),
    getTotalStatistics: vi.fn(),

    // Models
    importModel: vi.fn(),
    deleteModel: vi.fn(),
    getModelList: vi.fn(),

    // Window
    minimize: vi.fn(),
    close: vi.fn(),
    showOpenDialog: vi.fn(),
    showErrorDialog: vi.fn()
  } as any
}

// Mock Live2D Cubism Core
if (!(window as any).Live2DCubismCore) {
  (window as any).Live2DCubismCore = {
    Version: {
      csmGetVersion: () => '4.0.0'
    }
  }
}

// Mock Live2D Compatibility Layer
if (!(window as any).Live2D) {
  (window as any).Live2D = {
    __compatibility_layer: true,
    VERSION_MAJOR: 2,
    VERSION_MINOR: 1,
    VERSION_PATCH: 0
  }
}

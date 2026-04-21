import { ref } from 'vue'
import { useMessage } from 'naive-ui'

type MessageApi = ReturnType<typeof useMessage>

export function useSettingsWindowChrome(message: MessageApi) {
  const isWindowMaximized = ref(false)

  async function loadInitialState() {
    try {
      isWindowMaximized.value = await window.electron.window.isMaximizedCurrent()
    } catch {
      isWindowMaximized.value = false
    }
  }

  function applyMaximizedChanged(maximized: boolean) {
    isWindowMaximized.value = maximized
  }

  async function handleMinimizeWindow() {
    const result = await window.electron.window.minimizeCurrent()
    if (!result.success) {
      message.error(result.error || '最小化失败')
    }
  }

  async function handleToggleWindowMaximize() {
    const result = await window.electron.window.toggleMaximizeCurrent()
    if (!result.success) {
      message.error(result.error || '切换窗口状态失败')
      return
    }

    isWindowMaximized.value = Boolean(result.maximized)
  }

  async function handleCloseWindow() {
    const result = await window.electron.window.closeCurrent()
    if (!result.success) {
      message.error(result.error || '关闭窗口失败')
    }
  }

  function handleTitleBarDoubleClick() {
    void handleToggleWindowMaximize()
  }

  return {
    isWindowMaximized,
    applyMaximizedChanged,
    handleCloseWindow,
    handleMinimizeWindow,
    handleTitleBarDoubleClick,
    handleToggleWindowMaximize,
    loadInitialState,
  }
}

/**
 * UI 状态管理
 * 管理全局 UI 状态（菜单、对话框、加载状态等）
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export type DialogType = 'settings' | 'history' | 'statistics' | 'message-detail' | null

export const useUIStore = defineStore('ui', () => {
  // 对话框状态
  const currentDialog = ref<DialogType>(null)
  const dialogData = ref<any>(null)

  // 菜单状态
  const isMenuOpen = ref(false)
  const menuPosition = ref({ x: 0, y: 0 })

  // 全局加载状态
  const isGlobalLoading = ref(false)
  const loadingMessage = ref('')

  // 录音状态
  const isRecording = ref(false)

  // 气泡对话框状态
  const bubbleVisible = ref(false)
  const bubbleContent = ref('')
  const bubblePosition = ref({ x: 0, y: 0 })

  // 图片显示状态
  const imageVisible = ref(false)
  const imageUrl = ref('')

  // 操作

  /**
   * 打开对话框
   */
  function openDialog(type: DialogType, data?: any) {
    currentDialog.value = type
    dialogData.value = data
  }

  /**
   * 关闭对话框
   */
  function closeDialog() {
    currentDialog.value = null
    dialogData.value = null
  }

  /**
   * 切换对话框
   */
  function toggleDialog(type: DialogType, data?: any) {
    if (currentDialog.value === type) {
      closeDialog()
    } else {
      openDialog(type, data)
    }
  }

  /**
   * 打开菜单
   */
  function openMenu(x: number, y: number) {
    isMenuOpen.value = true
    menuPosition.value = { x, y }
  }

  /**
   * 关闭菜单
   */
  function closeMenu() {
    isMenuOpen.value = false
  }

  /**
   * 设置全局加载状态
   */
  function setGlobalLoading(loading: boolean, message = '') {
    isGlobalLoading.value = loading
    loadingMessage.value = message
  }

  /**
   * 设置录音状态
   */
  function setRecording(recording: boolean) {
    isRecording.value = recording
  }

  /**
   * 显示气泡对话框
   */
  function showBubble(content: string, x: number, y: number) {
    bubbleContent.value = content
    bubblePosition.value = { x, y }
    bubbleVisible.value = true
  }

  /**
   * 隐藏气泡对话框
   */
  function hideBubble() {
    bubbleVisible.value = false
  }

  /**
   * 显示图片
   */
  function showImage(url: string) {
    imageUrl.value = url
    imageVisible.value = true
  }

  /**
   * 隐藏图片
   */
  function hideImage() {
    imageVisible.value = false
    imageUrl.value = ''
  }

  return {
    // 对话框状态
    currentDialog,
    dialogData,

    // 菜单状态
    isMenuOpen,
    menuPosition,

    // 全局加载状态
    isGlobalLoading,
    loadingMessage,

    // 录音状态
    isRecording,

    // 气泡对话框状态
    bubbleVisible,
    bubbleContent,
    bubblePosition,

    // 图片显示状态
    imageVisible,
    imageUrl,

    // 操作
    openDialog,
    closeDialog,
    toggleDialog,
    openMenu,
    closeMenu,
    setGlobalLoading,
    setRecording,
    showBubble,
    hideBubble,
    showImage,
    hideImage
  }
})

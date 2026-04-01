import { ref, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import type { useThemeStore } from '@/stores/theme'
import { withAlpha } from '@/utils/themePalette'
import {
  ChartColumn, Settings, MessageCircle,
} from 'lucide-vue-next'

const MENU_RADIUS = 100

interface UseRadialMenuOptions {
  themeStore: ReturnType<typeof useThemeStore>
  openHistory: () => Promise<void>
  openSettings: () => Promise<void>
  openInput: () => void
}

export function useRadialMenu(options: UseRadialMenuOptions) {
  const { themeStore, openHistory, openSettings, openInput } = options
  const { palette } = storeToRefs(themeStore)

  const showMenu = ref(false)
  const menuStyle = ref({ left: '0px', top: '0px' })
  let menuAutoCloseTimer: number | null = null

  const menuThemeColor = computed(() => withAlpha(palette.value.accent, 0.14))
  const menuThemeColorHover = computed(() => withAlpha(palette.value.accent, 0.24))

  const menuItems = computed(() => [
    { key: 'history', icon: ChartColumn, label: '历史', action: openHistory },
    { key: 'settings', icon: Settings, label: '设置', action: openSettings },
    { key: 'talk', icon: MessageCircle, label: '对话', action: openInput }
  ])

  function startMenuAutoCloseTimer() {
    if (menuAutoCloseTimer !== null) {
      clearTimeout(menuAutoCloseTimer)
    }

    menuAutoCloseTimer = window.setTimeout(() => {
      showMenu.value = false
      menuAutoCloseTimer = null
    }, 2000)
  }

  function clearMenuAutoCloseTimer() {
    if (menuAutoCloseTimer !== null) {
      clearTimeout(menuAutoCloseTimer)
      menuAutoCloseTimer = null
    }
  }

  function handleModelRightClick(position: { x: number; y: number }, modelPositionRef: { x: number; y: number }) {
    modelPositionRef.x = position.x
    modelPositionRef.y = position.y

    menuStyle.value = {
      left: `${position.x + 30}px`,
      top: `${position.y + 30}px`
    }

    if (showMenu.value) {
      showMenu.value = false
      nextTick(() => {
        showMenu.value = true
      })
    } else {
      showMenu.value = true
    }

    startMenuAutoCloseTimer()
  }

  function handleMenuMouseEnter() {
    clearMenuAutoCloseTimer()
  }

  function handleMenuMouseLeave() {
    startMenuAutoCloseTimer()
  }

  function getMenuItemStyle(index: number, total: number) {
    const startAngle = -90
    const angleStep = 360 / total
    const angle = startAngle + index * angleStep
    const radian = (angle * Math.PI) / 180

    const x = Math.cos(radian) * MENU_RADIUS
    const y = Math.sin(radian) * MENU_RADIUS

    return {
      '--tx': `${x}px`,
      '--ty': `${y}px`,
      '--delay': `${index * 0.05}s`
    }
  }

  return {
    showMenu,
    menuStyle,
    menuThemeColor,
    menuThemeColorHover,
    menuItems,
    handleModelRightClick,
    startMenuAutoCloseTimer,
    clearMenuAutoCloseTimer,
    handleMenuMouseEnter,
    handleMenuMouseLeave,
    getMenuItemStyle,
  }
}

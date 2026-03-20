<template>
  <div 
    v-if="isSettingsWindow"
    ref="containerRef"
    class="color-ripple"
  >
    <div 
      v-if="isAnimating"
      class="color-ripple__overlay"
      :style="overlayStyle"
    ></div>
    <div
      v-if="isAnimating"
      ref="maskRef"
      class="color-ripple__mask"
      :style="maskStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { sourceColor } = storeToRefs(themeStore)

const containerRef = ref<HTMLDivElement>()
const maskRef = ref<HTMLDivElement>()
const isAnimating = ref(false)
const overlayStyle = ref<CSSProperties>({})
const maskStyle = ref<CSSProperties>({})

// 只在设置窗口中显示
const isSettingsWindow = computed(() => {
  const hash = window.location.hash
  return hash.startsWith('#/settings')
})

// 动画配置
const ANIMATION_DURATION = 1500

/**
 * 计算最大扩散半径
 */
function calculateMaxRadius(x: number, y: number, width: number, height: number): number {
  const corners = [
    { cx: 0, cy: 0 },
    { cx: width, cy: 0 },
    { cx: 0, cy: height },
    { cx: width, cy: height },
  ]
  
  let maxRadius = 0
  for (const corner of corners) {
    const distance = Math.sqrt(
      Math.pow(corner.cx - x, 2) + Math.pow(corner.cy - y, 2)
    )
    maxRadius = Math.max(maxRadius, distance)
  }
  
  return maxRadius
}

/**
 * 执行颜色涟漪扩散动画
 */
function animateColorRipple(newColor: string) {
  if (!containerRef.value) return
  
  const container = containerRef.value
  const width = container.clientWidth
  const height = container.clientHeight
  
  // 随机起点位置
  const startX = Math.random() * width
  const startY = Math.random() * height
  
  // 计算最大扩散半径
  const maxRadius = calculateMaxRadius(startX, startY, width, height)
  
  // 设置覆盖层样式（全屏，新颜色背景）
  overlayStyle.value = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: newColor,
    pointerEvents: 'none',
    zIndex: 9998,
    opacity: 1,
    transition: 'opacity 0s',
  }
  
  // 设置遮罩样式（全屏黑色背景，使用 radial-gradient 创建透明圆形）
  maskStyle.value = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 9999,
    background: `radial-gradient(circle at ${startX}px ${startY}px, transparent 0px, black 0px)`,
    transition: 'none',
  }
  
  isAnimating.value = true
  
  // 使用 requestAnimationFrame 确保样式已应用
  requestAnimationFrame(() => {
    if (!containerRef.value || !maskRef.value) return
    
    const mask = maskRef.value
    
    // 计算动画持续时间
    const duration = Math.max(ANIMATION_DURATION, maxRadius * 1.5)
    
    // 设置过渡效果
    mask.style.transition = `background ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
    
    // 开始动画：扩大透明圆形
    mask.style.background = `radial-gradient(circle at ${startX}px ${startY}px, transparent ${maxRadius * 2}px, black ${maxRadius * 2}px)`
    
    // 动画结束后清理
    setTimeout(() => {
      isAnimating.value = false
      overlayStyle.value = {}
      maskStyle.value = {}
    }, duration + 100)
  })
}

// 监听主题色变化
watch(sourceColor, (newColor, oldColor) => {
  if (oldColor && newColor !== oldColor && containerRef.value) {
    animateColorRipple(newColor)
  }
})

onMounted(() => {
  // 初始化
})

onUnmounted(() => {
  isAnimating.value = false
})
</script>

<style scoped>
.color-ripple {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.color-ripple__overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.color-ripple__mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mix-blend-mode: multiply;
}
</style>

<template>
  <div 
    v-if="isSettingsWindow"
    ref="containerRef"
    class="color-ripple"
  >
    <div 
      v-if="isAnimating"
      class="color-ripple__wave"
      :style="rippleStyle"
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
const isAnimating = ref(false)
const rippleStyle = ref<CSSProperties>({})

// 只在设置窗口中显示
const isSettingsWindow = computed(() => {
  const hash = window.location.hash
  return hash.startsWith('#/settings')
})

// 动画配置
const ANIMATION_DURATION = 1200 // 动画时长（毫秒）

/**
 * 计算最大扩散半径
 */
function calculateMaxRadius(x: number, y: number, width: number, height: number): number {
  // 计算从起点到四个角落的距离，取最大值
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
function animateColorRipple(newColor: string, _oldColor: string) {
  if (!containerRef.value) return
  
  const container = containerRef.value
  const width = container.clientWidth
  const height = container.clientHeight
  
  // 随机起点位置
  const startX = Math.random() * width
  const startY = Math.random() * height
  
  // 计算最大扩散半径
  const maxRadius = calculateMaxRadius(startX, startY, width, height)
  
  // 设置涟漪样式
  rippleStyle.value = {
    left: `${startX}px`,
    top: `${startY}px`,
    width: '0px',
    height: '0px',
    background: newColor,
    transform: 'translate(-50%, -50%)',
  }
  
  isAnimating.value = true
  
  // 使用 CSS 动画
  requestAnimationFrame(() => {
    if (!containerRef.value) return
    
    const ripple = containerRef.value.querySelector('.color-ripple__wave') as HTMLElement
    if (!ripple) return
    
    // 计算动画持续时间（基于最大半径）
    const duration = Math.max(ANIMATION_DURATION, maxRadius * 1.5)
    
    ripple.style.transition = `width ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), height ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
    ripple.style.width = `${maxRadius * 2}px`
    ripple.style.height = `${maxRadius * 2}px`
    
    // 动画结束后清理
    setTimeout(() => {
      isAnimating.value = false
      rippleStyle.value = {}
    }, duration + 100)
  })
}

// 监听主题色变化
watch(sourceColor, (newColor, oldColor) => {
  if (oldColor && newColor !== oldColor && containerRef.value) {
    animateColorRipple(newColor, oldColor)
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
  z-index: 9998;
  overflow: hidden;
}

.color-ripple__wave {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  will-change: width, height;
  /* 添加混合模式，让颜色更自然 */
  mix-blend-mode: normal;
  /* 添加轻微的模糊效果 */
  filter: blur(0px);
}
</style>

<template>
  <div 
    ref="containerRef"
    class="color-transition"
    :class="{ 'color-transition--active': isAnimating }"
  >
    <canvas ref="canvasRef" class="color-transition__canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { sourceColor } = storeToRefs(themeStore)

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const isAnimating = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null

// 动画配置
const ANIMATION_DURATION = 1500 // 动画时长（毫秒）

/**
 * 将 hex 颜色转换为 rgba
 */
function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 获取互补色（用于旧颜色区域）
 */
function getComplementaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  // 使用深色背景
  const bgR = Math.round((255 - r) * 0.2 + 15)
  const bgG = Math.round((255 - g) * 0.2 + 12)
  const bgB = Math.round((255 - b) * 0.2 + 10)
  
  return `#${bgR.toString(16).padStart(2, '0')}${bgG.toString(16).padStart(2, '0')}${bgB.toString(16).padStart(2, '0')}`
}

/**
 * 执行颜色波纹扩散动画
 */
function animateColorTransition(newColor: string, oldColor: string) {
  if (!canvasRef.value || !ctx) return
  
  const canvas = canvasRef.value
  const width = canvas.width
  const height = canvas.height
  
  // 随机起点位置
  const startX = Math.random() * width
  const startY = Math.random() * height
  
  // 计算最大半径（从起点到最远角落的距离）
  const maxRadius = Math.sqrt(
    Math.pow(Math.max(startX, width - startX), 2) +
    Math.pow(Math.max(startY, height - startY), 2)
  )
  
  const startTime = performance.now()
  const newColorRgba = hexToRgba(newColor)
  const oldColorRgba = hexToRgba(getComplementaryColor(oldColor))
  
  isAnimating.value = true
  
  function draw(currentTime: number) {
    if (!ctx) return
    
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1)
    
    // 使用 ease-out 缓动函数
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    const currentRadius = easedProgress * maxRadius
    
    // 清空画布
    ctx.clearRect(0, 0, width, height)
    
    // 绘制旧颜色背景
    ctx.fillStyle = oldColorRgba
    ctx.fillRect(0, 0, width, height)
    
    // 绘制新颜色圆形（从中心向外扩散）
    ctx.save()
    ctx.beginPath()
    ctx.arc(startX, startY, currentRadius, 0, Math.PI * 2)
    ctx.clip()
    
    ctx.fillStyle = newColorRgba
    ctx.fillRect(0, 0, width, height)
    
    ctx.restore()
    
    // 添加波纹边缘光晕效果
    if (progress < 1) {
      const gradient = ctx.createRadialGradient(
        startX, startY, currentRadius - 30,
        startX, startY, currentRadius + 30
      )
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      
      ctx.beginPath()
      ctx.arc(startX, startY, currentRadius + 30, 0, Math.PI * 2)
      ctx.clip()
      
      ctx.beginPath()
      ctx.arc(startX, startY, currentRadius, 0, Math.PI * 2)
      ctx.clip('evenodd')
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
    
    if (progress < 1) {
      animationId = requestAnimationFrame(draw)
    } else {
      // 动画结束
      isAnimating.value = false
      if (animationId) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
    }
  }
  
  animationId = requestAnimationFrame(draw)
}

/**
 * 初始化 Canvas
 */
function initCanvas() {
  if (!canvasRef.value || !containerRef.value) return
  
  const canvas = canvasRef.value
  const container = containerRef.value
  
  // 设置 canvas 尺寸
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  
  ctx = canvas.getContext('2d')
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
  if (!canvasRef.value || !containerRef.value) return
  
  const canvas = canvasRef.value
  const container = containerRef.value
  
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
}

// 监听主题色变化
watch(sourceColor, (newColor, oldColor) => {
  if (oldColor && newColor !== oldColor && canvasRef.value && ctx) {
    animateColorTransition(newColor, oldColor)
  }
})

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.color-transition {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.color-transition--active {
  opacity: 1;
}

.color-transition__canvas {
  width: 100%;
  height: 100%;
}
</style>

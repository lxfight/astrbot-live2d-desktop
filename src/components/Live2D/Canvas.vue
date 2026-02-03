<template>
  <canvas ref="canvasRef" class="live2d-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Live2DModel } from '@/utils/Live2DModel'

const canvasRef = ref<HTMLCanvasElement>()
let model: Live2DModel | null = null

const emit = defineEmits<{
  modelLoaded: []
  modelClick: [{ x: number; y: number }]
  modelInfoChanged: [{ name: string; motionGroups: string[]; expressions: string[] }]
}>()

/**
 * 加载 Live2D 模型
 */
async function loadModel(modelPath: string) {
  if (!canvasRef.value) {
    console.error('[Live2D] Canvas 未初始化')
    return
  }

  try {
    console.log('[Live2D] 开始加载模型:', modelPath)

    // 如果有旧模型，先销毁（仅移除模型，保留 Application）
    if (model) {
      console.log('[Live2D] 移除旧模型...')
      model.destroy()
      model = null
    }

    // 加载新模型
    model = await Live2DModel.from(modelPath)

    // 初始化或更新 WebGL（复用 Application）
    model.initWebGL(canvasRef.value)

    console.log('[Live2D] 模型加载成功')
    emit('modelLoaded')

    // 获取并发送模型信息
    const modelInfo = model.getModelInfo()
    emit('modelInfoChanged', modelInfo)
    console.log('[Live2D] 模型信息已发送:', modelInfo)
  } catch (error) {
    console.error('[Live2D] 模型加载失败:', error)
    throw error
  }
}

/**
 * 获取当前模型信息
 */
function getModelInfo() {
  if (!model) {
    return { name: '', motionGroups: [], expressions: [] }
  }
  return model.getModelInfo()
}

/**
 * 播放动作
 */
function playMotion(group: string, index: number = 0, priority: number = 2) {
  if (!model) return
  model.motion(group, index)
}

/**
 * 设置表情
 */
function setExpression(expressionId: string | number) {
  if (!model) return
  model.expression(expressionId)
}

/**
 * 播放随机动作
 */
function playRandomMotion() {
  // TODO: 实现随机动作
  console.log('[Live2D] 播放随机动作')
}

/**
 * 处理画布点击
 */
function handleCanvasClick(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !model) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 使用 PIXI 的 interaction 系统检测点击
  const PIXI = (window as any).PIXI
  if (!PIXI || !model.model) return

  // 将屏幕坐标转换为模型本地坐标
  const localPoint = model.model.toLocal(new PIXI.Point(x, y))

  // 检查点击是否在模型的边界内
  const bounds = model.model.getBounds()
  const isHit = bounds.contains(x, y)

  console.log('[Canvas] 点击检测:', { x, y, isHit, bounds: bounds.toString() })

  // 只有点击到模型时才触发事件并阻止冒泡
  if (isHit) {
    event.stopPropagation()
    emit('modelClick', { x, y })
  }
  // 如果没有点击到模型，让事件继续冒泡到父组件
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
  if (canvasRef.value && model) {
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight

    // 调整模型大小（不重新创建 Application）
    model.resize(window.innerWidth, window.innerHeight)
  }
}

onMounted(() => {
  if (canvasRef.value) {
    // 设置画布大小
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight

    // 监听点击事件（包括右键）
    canvasRef.value.addEventListener('click', handleCanvasClick)
    canvasRef.value.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      handleCanvasClick(e as MouseEvent)
    })

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  if (model) {
    model.destroy()
    model = null
  }

  // 只在组件卸载时销毁整个 Application
  Live2DModel.destroyApp()

  if (canvasRef.value) {
    canvasRef.value.removeEventListener('click', handleCanvasClick)
  }

  window.removeEventListener('resize', handleResize)
})

// 暴露方法给父组件
defineExpose({
  loadModel,
  playMotion,
  setExpression,
  playRandomMotion,
  getModelInfo
})
</script>

<style scoped>
.live2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

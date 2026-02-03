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
  modelRightClick: [{ x: number; y: number }]
  modelInfoChanged: [{ name: string; motionGroups: string[]; expressions: string[] }]
  modelPositionChanged: [{ x: number; y: number }]
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
 * 设置模型位置
 */
function setModelPosition(x: number, y: number) {
  if (!model || !model.model) return
  model.model.x = x
  model.model.y = y
  console.log('[Live2D] 模型位置已设置:', { x, y })
}

/**
 * 获取模型位置
 */
function getModelPosition(): { x: number; y: number } | null {
  if (!model || !model.model) return null
  return {
    x: model.model.x,
    y: model.model.y
  }
}

// 拖动相关状态
let isDragging = false
let isDragStartedOnModel = false // 标记拖动是否从模型上开始
let dragStartX = 0
let dragStartY = 0
let modelOffsetX = 0
let modelOffsetY = 0
const DRAG_THRESHOLD = 5 // 拖动阈值（像素）
let passThroughEnabled = true // 是否启用动态穿透

/**
 * 检查点是否在模型范围内（使用简单的矩形检测，避免 GPU ReadPixels）
 */
function isPointInModel(x: number, y: number): boolean {
  if (!model || !model.model) return false

  const modelSprite = model.model
  const modelX = modelSprite.x
  const modelY = modelSprite.y
  const modelWidth = modelSprite.width
  const modelHeight = modelSprite.height
  const anchorX = modelSprite.anchor?.x ?? 0.5
  const anchorY = modelSprite.anchor?.y ?? 0.5

  // 计算模型的边界框
  const left = modelX - modelWidth * anchorX
  const right = modelX + modelWidth * (1 - anchorX)
  const top = modelY - modelHeight * anchorY
  const bottom = modelY + modelHeight * (1 - anchorY)

  // 简单的矩形碰撞检测
  return x >= left && x <= right && y >= top && y <= bottom
}

/**
 * 处理鼠标按下
 */
function handleMouseDown(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !model) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查是否点击到模型（使用优化的检测方法）
  const hitModel = isPointInModel(x, y)

  // 左键开始拖动
  if (event.button === 0 && hitModel) {
    isDragging = false // 先标记为未拖动，等移动超过阈值再标记
    isDragStartedOnModel = true // 标记拖动从模型上开始
    dragStartX = event.clientX
    dragStartY = event.clientY

    // 获取当前模型位置
    if (model.model) {
      modelOffsetX = model.model.x
      modelOffsetY = model.model.y
    }

    event.preventDefault()
  }
}

/**
 * 处理鼠标移动
 */
function handleMouseMove(event: MouseEvent) {
  if (!model || !model.model) return

  // 只有当拖动从模型上开始时才允许拖动
  if (event.buttons === 1 && isDragStartedOnModel) {
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY

    // 判断是否超过拖动阈值
    if (!isDragging && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      isDragging = true
    }

    // 如果正在拖动，更新模型位置
    if (isDragging) {
      model.model.x = modelOffsetX + deltaX
      model.model.y = modelOffsetY + deltaY

      // 发射模型位置变化事件
      emit('modelPositionChanged', {
        x: model.model.x,
        y: model.model.y
      })

      event.preventDefault()
    }
  }
}

/**
 * 处理鼠标释放
 */
function handleMouseUp(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !model) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查是否点击到模型（使用优化的检测方法）
  const isHit = isPointInModel(x, y)

  // 如果没有拖动且点击到模型，触发点击事件
  if (!isDragging && isHit && isDragStartedOnModel) {
    event.stopPropagation()
    emit('modelClick', { x: event.clientX, y: event.clientY })
  }

  // 重置拖动状态
  isDragging = false
  isDragStartedOnModel = false
}

/**
 * 处理右键点击
 */
function handleContextMenu(event: MouseEvent) {
  event.preventDefault()

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !model) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查是否点击到模型（使用优化的检测方法）
  const isHit = isPointInModel(x, y)

  if (isHit) {
    event.stopPropagation()

    // 发射右键点击事件，同时传递模型当前位置
    if (model && model.model) {
      emit('modelRightClick', {
        x: model.model.x,
        y: model.model.y
      })
    }
  }
}

/**
 * 处理画布点击（已废弃，保留用于兼容）
 */
function handleCanvasClick(event: MouseEvent) {
  // 此函数已被 handleMouseUp 和 handleContextMenu 替代
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

/**
 * 处理鼠标移动（用于动态设置穿透）
 */
function handleMouseMoveForPassThrough(event: MouseEvent) {
  // 如果动态穿透被禁用（有 UI 显示），不处理
  if (!passThroughEnabled) return

  if (!canvasRef.value || !model) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查鼠标是否在模型上
  const isOnModel = isPointInModel(x, y)

  // 动态设置窗口穿透
  // 参数说明：
  // - ignore: true = 穿透，false = 不穿透
  // - options.forward: true = 将事件转发给下层窗口
  if (isOnModel) {
    // 鼠标在模型上：不穿透，不转发
    window.electron.window.setIgnoreMouseEvents(false)
  } else {
    // 鼠标不在模型上：穿透，转发给桌面
    window.electron.window.setIgnoreMouseEvents(true)
  }
}

/**
 * 禁用动态穿透（当有 UI 元素显示时）
 */
function disablePassThrough() {
  passThroughEnabled = false
  window.electron.window.setIgnoreMouseEvents(false)
}

/**
 * 启用动态穿透
 */
function enablePassThrough() {
  passThroughEnabled = true
  // 立即检查当前鼠标位置
  const event = new MouseEvent('mousemove')
  handleMouseMoveForPassThrough(event as any)
}

onMounted(() => {
  if (canvasRef.value) {
    // 设置画布大小
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight

    // 监听鼠标事件
    canvasRef.value.addEventListener('mousedown', handleMouseDown)
    canvasRef.value.addEventListener('mousemove', handleMouseMove)
    canvasRef.value.addEventListener('mouseup', handleMouseUp)
    canvasRef.value.addEventListener('contextmenu', handleContextMenu)

    // 监听鼠标移动以动态设置穿透
    window.addEventListener('mousemove', handleMouseMoveForPassThrough)

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
    canvasRef.value.removeEventListener('mousedown', handleMouseDown)
    canvasRef.value.removeEventListener('mousemove', handleMouseMove)
    canvasRef.value.removeEventListener('mouseup', handleMouseUp)
    canvasRef.value.removeEventListener('contextmenu', handleContextMenu)
  }

  window.removeEventListener('mousemove', handleMouseMoveForPassThrough)
  window.removeEventListener('resize', handleResize)
})

// 暴露方法给父组件
defineExpose({
  loadModel,
  playMotion,
  setExpression,
  playRandomMotion,
  getModelInfo,
  disablePassThrough,
  enablePassThrough,
  setModelPosition,
  getModelPosition
})
</script>

<style scoped>
.live2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: auto; /* Canvas 可以接收鼠标事件 */
}
</style>

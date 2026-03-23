<template>
  <canvas ref="canvasRef" class="live2d-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { PlatformCapabilities } from '@/types/electron'
import { CubismModel as Live2DModel } from '@/utils/cubism/CubismModel'

const canvasRef = ref<HTMLCanvasElement>()
let model: Live2DModel | null = null
let renderFrameId: number | null = null

function stopRenderLoop() {
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId)
    renderFrameId = null
  }
}

function startRenderLoop() {
  stopRenderLoop()

  const renderFrame = () => {
    if (!model) {
      renderFrameId = null
      return
    }

    model.update()
    model.render()
    renderFrameId = requestAnimationFrame(renderFrame)
  }

  renderFrame()
}

const emit = defineEmits<{
  modelLoaded: []
  modelClick: [{ x: number; y: number }]
  modelRightClick: [{ x: number; y: number }]
  modelInfoChanged: [{
    name: string;
    motionGroups: Record<string, Array<{ index: number; file: string }>>;
    expressions: string[]
  }]
  modelPositionChanged: [{ x: number; y: number }]
}>()

/**
 * 加载 Live2D 模型
 */
async function loadModel(modelPath: string, initialPosition?: { x: number; y: number }) {
  if (!canvasRef.value) {
    console.error('[Live2D] Canvas 未初始化')
    return
  }

  try {
    console.log('[Live2D] 开始加载模型:', modelPath)

    // 如果有旧模型，先销毁（仅移除模型，保留 Application）
    if (model) {
      console.log('[Live2D] 移除旧模型...')
      stopRenderLoop()
      model.destroy()
      model = null
    }

    // 加载新模型
    model = await Live2DModel.from(modelPath)

    // 初始化 WebGL 并启动渲染循环，传入初始位置
    model.initWebGL(canvasRef.value, initialPosition)
    await model.loadTextures()
    startRenderLoop()

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
function playMotion(group: string, index: number = 0, priority?: number) {
  if (!model) return
  model.motion(group, index, priority)
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
  if (!model) return

  const info = model.getModelInfo()
  const groupNames = Object.keys(info.motionGroups).filter((group) => {
    const motions = info.motionGroups[group]
    return Array.isArray(motions) && motions.length > 0
  })

  if (groupNames.length === 0) {
    console.warn('[Live2D] 当前模型没有可用动作组')
    return
  }

  const group = groupNames[Math.floor(Math.random() * groupNames.length)]
  const motions = info.motionGroups[group]
  const motion = motions[Math.floor(Math.random() * motions.length)]

  model.motion(group, motion.index)
}

/**
 * 设置模型位置
 */
function setModelPosition(x: number, y: number) {
  if (!model) return
  model.setModelPosition(x, y)
  console.log('[Live2D] 模型位置已设置:', { x, y })
}

/**
 * 获取模型位置
 */
function getModelPosition(): { x: number; y: number } | null {
  if (!model) return null
  return model.getModelPosition()
}

function getModelBounds(): {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
} | null {
  if (!model) return null
  return model.getModelBounds()
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
let isFullPassThroughMode = false // 是否处于完全穿透模式
let supportsDynamicPassThrough = true

/**
 * 检查点是否在模型内
 */
function isPointInModel(x: number, y: number): boolean {
  if (!model) return false
  return model.isPointInModel(x, y)
}

/**
 * 处理鼠标按下
 */
function handleMouseDown(event: MouseEvent) {
  // 如果处于完全穿透模式，不处理任何鼠标事件
  if (isFullPassThroughMode) return

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
    const position = model.getModelPosition()
    if (position) {
      modelOffsetX = position.x
      modelOffsetY = position.y
    }

    event.preventDefault()
  }
}

/**
 * 处理鼠标移动
 */
function handleMouseMove(event: MouseEvent) {
  // 如果处于完全穿透模式，不处理任何鼠标事件
  if (isFullPassThroughMode) return

  if (!model) return

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
      const newX = modelOffsetX + deltaX
      const newY = modelOffsetY + deltaY
      model.setModelPosition(newX, newY)

      // 发射模型位置变化事件
      emit('modelPositionChanged', {
        x: newX,
        y: newY
      })

      event.preventDefault()
    }
  }
}

/**
 * 处理鼠标释放
 */
function handleMouseUp(event: MouseEvent) {
  // 如果处于完全穿透模式，不处理任何鼠标事件
  if (isFullPassThroughMode) return

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

  // 如果处于完全穿透模式，不处理任何鼠标事件
  if (isFullPassThroughMode) return

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !model) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查是否点击到模型（使用优化的检测方法）
  const isHit = isPointInModel(x, y)

  if (isHit) {
    event.stopPropagation()

    // 发射右键点击事件，传递鼠标点击位置（屏幕坐标）
    if (model) {
      emit('modelRightClick', {
        x: event.clientX,
        y: event.clientY
      })
    }
  }
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

let currentIgnoreMouseEvents = true // 当前穿透状态

/**
 * 检查鼠标是否在需要交互的 UI 元素上（气泡、菜单、输入框等）
 */
function isPointOnInteractiveUI(clientX: number, clientY: number): boolean {
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!element) return false

  return Boolean(
    element.closest('.bubble') ||
    element.closest('.radial-menu-container') ||
    element.closest('.input-panel-container') ||
    element.closest('.recording-toast') ||
    element.closest('.empty-state')
  )
}

/**
 * 处理鼠标移动（用于动态设置穿透）
 */
function handleMouseMoveForPassThrough(event: MouseEvent) {
  // 眼睛跟踪鼠标（不受穿透模式限制）
  if (model) {
    model.focus(event.clientX, event.clientY)
  }

  // 如果处于完全穿透模式，不处理穿透逻辑
  if (isFullPassThroughMode) return

  // 如果动态穿透被禁用（有 UI 显示），不处理
  if (!passThroughEnabled) return
  if (!supportsDynamicPassThrough) return

  if (!canvasRef.value || !model) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查鼠标是否在模型上
  const isOnModel = isPointInModel(x, y)
  // 检查鼠标是否在需要交互的 UI 元素上（如消息气泡）
  const isOnInteractiveUI = isPointOnInteractiveUI(event.clientX, event.clientY)
  const shouldCaptureMouse = isOnModel || isOnInteractiveUI

  // 动态设置窗口穿透
  // 参数说明：
  // - ignore: true = 穿透，false = 不穿透
  // - options.forward: true = 将事件转发给下层窗口
  if (shouldCaptureMouse) {
    // 鼠标在模型或交互 UI 上：不穿透，不转发
    if (currentIgnoreMouseEvents) {
      window.electron.window.setIgnoreMouseEvents(false)
      currentIgnoreMouseEvents = false
    }
  } else {
    // 鼠标不在模型和交互 UI 上：穿透，转发给桌面
    if (!currentIgnoreMouseEvents) {
      window.electron.window.setIgnoreMouseEvents(true)
      currentIgnoreMouseEvents = true
    }
  }
}

/**
 * 禁用动态穿透（当有 UI 元素显示时）
 */
function disablePassThrough() {
  if (!supportsDynamicPassThrough) return
  passThroughEnabled = false
  if (currentIgnoreMouseEvents) {
    window.electron.window.setIgnoreMouseEvents(false)
    currentIgnoreMouseEvents = false
  }
}

/**
 * 启用动态穿透
 */
function enablePassThrough() {
  if (!supportsDynamicPassThrough) return
  passThroughEnabled = true
  // 恢复动态穿透，等待下一次鼠标移动事件来更新状态
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

    // 初始化平台能力（不支持 forward 时关闭动态穿透，避免窗口卡死在穿透态）
    window.electron.window.getPlatformCapabilities().then((capabilities: PlatformCapabilities) => {
      supportsDynamicPassThrough = capabilities.mousePassthroughForward
      if (!supportsDynamicPassThrough) {
        passThroughEnabled = false
        currentIgnoreMouseEvents = false
        window.electron.window.setIgnoreMouseEvents(false)
        console.warn('[Live2D] 当前平台不支持穿透事件转发，已禁用动态穿透')
      }
    }).catch(() => {
      // 获取失败时保持默认行为
    })

    // 监听完全穿透模式变化
    window.electron.window.onPassThroughModeChanged((enabled: boolean) => {
      console.log('[Live2D] 完全穿透模式:', enabled ? '开启' : '关闭')
      isFullPassThroughMode = enabled

      // 立即应用穿透设置
      if (enabled) {
        window.electron.window.setIgnoreMouseEvents(true)
      } else {
        window.electron.window.setIgnoreMouseEvents(false)
      }
    })

    // 初始化时检查穿透模式状态
    window.electron.window.getPassThroughMode().then((enabled: boolean) => {
      console.log('[Live2D] 初始穿透模式状态:', enabled ? '开启' : '关闭')
      isFullPassThroughMode = enabled

      // 立即应用穿透设置
      if (enabled) {
        window.electron.window.setIgnoreMouseEvents(true)
      }
    })
  }
})

onUnmounted(() => {
  stopRenderLoop()

  if (model) {
    model.destroy()
    model = null
  }

  // 销毁全局资源
  // CubismModel.destroyGlobal()

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
  getModelInfo,
  playMotion,
  setExpression,
  playRandomMotion,
  getModelPosition,
  setModelPosition,
  getModelBounds,
  getTextureSource: () => model?.getTextureSource(),
  getTextureSources: () => model?.getTextureSources() || [],
  startLipSync: (audioElement: HTMLAudioElement) => {
    if (model) {
      model.startLipSync(audioElement)
    }
  },
  stopLipSync: () => {
    model?.stopLipSync()
  },
  disablePassThrough,
  enablePassThrough
})
</script>

<script lang="ts">
export default {
  name: 'Live2DCanvas'
}
</script>

<style scoped>
.live2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: auto; /* Canvas 可以接收鼠标事件 */
}
</style>

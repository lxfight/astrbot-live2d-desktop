<template>
  <canvas ref="canvasRef" class="live2d-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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

function getModelOverlayBounds(): {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
  anchorX: number
  topCenterY: number
  bottomCenterY: number
} | null {
  if (!model) return null
  return model.getModelOverlayBounds()
}

// 拖动相关状态
let isDragging = false
let isDragStartedOnModel = false // 标记拖动是否从模型上开始
let dragStartX = 0
let dragStartY = 0
let cursorOffsetX = 0
let cursorOffsetY = 0
const DRAG_THRESHOLD = 10 // 拖动阈值（像素）
let isFullPassThroughMode = false
let dynamicPassThroughEnabled = true
let supportsDynamicPassThrough = false
let currentIgnoreMouseEvents = false
let passThroughFrameId: number | null = null
let pendingPassThroughEvent: MouseEvent | null = null
let lastPointerEvent: MouseEvent | null = null
let disposeDesktopBehaviorListener: Unsubscribe | null = null

function stopPassThroughDetection() {
  if (passThroughFrameId !== null) {
    cancelAnimationFrame(passThroughFrameId)
    passThroughFrameId = null
  }
  pendingPassThroughEvent = null
}

async function setMousePassthrough(ignoreMouseEvents: boolean) {
  if (currentIgnoreMouseEvents === ignoreMouseEvents) {
    return
  }

  currentIgnoreMouseEvents = ignoreMouseEvents

  try {
    await window.electron.desktopBehavior.setMousePassthrough(ignoreMouseEvents)
  } catch (error) {
    console.warn('[Live2D] 更新鼠标穿透状态失败:', error)
  }
}

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
      cursorOffsetX = x - position.x
      cursorOffsetY = y - position.y
    }

    event.preventDefault()
  }
}

/**
 * 处理鼠标移动
 */
function handleMouseMove(event: MouseEvent) {
  if (!model) return

  // 只有当拖动从模型上开始时才允许拖动
  if (event.buttons === 1 && isDragStartedOnModel) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY

    // 判断是否超过拖动阈值
    if (!isDragging && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      isDragging = true
    }

    // 如果正在拖动，更新模型位置
    if (isDragging) {
      const newX = pointerX - cursorOffsetX
      const newY = pointerY - cursorOffsetY
      model.setModelPosition(newX, newY)
      const actualPosition = model.getModelPosition()

      // 发射模型位置变化事件
      emit('modelPositionChanged', {
        x: actualPosition?.x ?? newX,
        y: actualPosition?.y ?? newY
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

function isPointOnInteractiveUI(clientX: number, clientY: number): boolean {
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!element) return false

  return Boolean(
    element.closest('.bubble') ||
    element.closest('.radial-menu-container') ||
    element.closest('.input-panel-container') ||
    element.closest('.recording-toast') ||
    element.closest('.model-status-toast') ||
    element.closest('.empty-state')
  )
}

function shouldIgnoreMouseEvents(event: MouseEvent): boolean {
  if (isFullPassThroughMode) {
    return true
  }

  if (!dynamicPassThroughEnabled || !supportsDynamicPassThrough) {
    return false
  }

  if (!canvasRef.value || !model) {
    return false
  }

  if (isPointOnInteractiveUI(event.clientX, event.clientY)) {
    return false
  }

  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  return !isPointInModel(x, y)
}

async function syncMousePassthrough() {
  if (isFullPassThroughMode) {
    await setMousePassthrough(true)
    return
  }

  if (!dynamicPassThroughEnabled || !supportsDynamicPassThrough) {
    await setMousePassthrough(false)
    return
  }

  if (!model) {
    await setMousePassthrough(false)
    return
  }

  if (!lastPointerEvent) {
    await setMousePassthrough(false)
    return
  }

  await setMousePassthrough(shouldIgnoreMouseEvents(lastPointerEvent))
}

async function applyDesktopBehaviorSnapshot(snapshot: DesktopBehaviorSnapshot) {
  isFullPassThroughMode = snapshot.preferences.fullPassThrough
  dynamicPassThroughEnabled = snapshot.preferences.dynamicPassThrough
  await syncMousePassthrough()
}

function handleWindowMouseMove(event: MouseEvent) {
  if (model) {
    model.focus(event.clientX, event.clientY)
  }

  lastPointerEvent = event
  pendingPassThroughEvent = event

  if (passThroughFrameId !== null) {
    return
  }

  passThroughFrameId = requestAnimationFrame(() => {
    passThroughFrameId = null
    const latestEvent = pendingPassThroughEvent
    pendingPassThroughEvent = null
    if (!latestEvent) return
    void setMousePassthrough(shouldIgnoreMouseEvents(latestEvent))
  })
}

onMounted(async () => {
  if (canvasRef.value) {
    // 设置画布大小
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight

    // 监听鼠标事件
    canvasRef.value.addEventListener('mousedown', handleMouseDown)
    canvasRef.value.addEventListener('mousemove', handleMouseMove)
    canvasRef.value.addEventListener('mouseup', handleMouseUp)
    canvasRef.value.addEventListener('contextmenu', handleContextMenu)

    // 眼睛跟踪鼠标
    window.addEventListener('mousemove', handleWindowMouseMove)

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)

    try {
      const capabilities = await window.electron.window.getPlatformCapabilities()
      supportsDynamicPassThrough = capabilities.mousePassthroughForward
    } catch {
      supportsDynamicPassThrough = false
    }

    try {
      const snapshot = await window.electron.desktopBehavior.getSnapshot()
      await applyDesktopBehaviorSnapshot(snapshot)
    } catch (error) {
      console.warn('[Live2D] 获取桌面行为快照失败:', error)
      await setMousePassthrough(false)
    }

    disposeDesktopBehaviorListener = window.electron.desktopBehavior.onSnapshotChanged((snapshot) => {
      void applyDesktopBehaviorSnapshot(snapshot)
    })
  }
})

onUnmounted(() => {
  stopRenderLoop()
  stopPassThroughDetection()

  if (model) {
    model.destroy()
    model = null
  }

  // 销毁全局资源（WASM 内存）
  Live2DModel.destroyGlobal()

  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousedown', handleMouseDown)
    canvasRef.value.removeEventListener('mousemove', handleMouseMove)
    canvasRef.value.removeEventListener('mouseup', handleMouseUp)
    canvasRef.value.removeEventListener('contextmenu', handleContextMenu)
  }

  window.removeEventListener('mousemove', handleWindowMouseMove)
  window.removeEventListener('resize', handleResize)
  disposeDesktopBehaviorListener?.()
  disposeDesktopBehaviorListener = null
  void setMousePassthrough(false)
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
  getModelOverlayBounds,
  getTextureSource: () => model?.getTextureSource(),
  getTextureSources: () => model?.getTextureSources() || [],
  startLipSync: (audioElement: HTMLAudioElement) => {
    if (model) {
      model.startLipSync(audioElement)
    }
  },
  stopLipSync: () => {
    model?.stopLipSync()
  }
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

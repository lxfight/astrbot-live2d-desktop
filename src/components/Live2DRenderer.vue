<template>
  <div ref="canvasContainer" class="live2d-container">
    <canvas ref="canvas"></canvas>
    <!-- 调试：绘制检测区域边界 -->
    <canvas ref="debugCanvas" class="debug-canvas" v-if="debugMode"></canvas>
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载模型中...</p>
    </div>
    <div v-if="error" class="error-overlay">
      <p>❌ {{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application } from 'pixi.js'
import { MousePassthroughManager } from '../utils/mousePassthrough'
import { getModelInfo as getModelDetails, type ParsedModelInfo } from '../utils/modelLoader'
import { logger } from '../utils/logger'

const emit = defineEmits<{
  (e: 'model-input', payload: { x: number; y: number; hitAreas: string[] }): void
}>()

// 确保使用 Cubism 4
if (window.PIXI) {
  (window as any).PIXI = window.PIXI
}

const canvasContainer = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const debugCanvas = ref<HTMLCanvasElement>()
let app: Application | null = null
let model: any = null
let passthroughManager: MousePassthroughManager | null = null

const loading = ref(true)
const error = ref('')
const currentModelPath = ref('/models/default/model3.json')
const currentModelInfo = ref<ParsedModelInfo | null>(null)
const debugMode = ref(import.meta.env.DEV) // 仅开发环境启用调试模式

onMounted(async () => {
  if (!canvas.value || !canvasContainer.value) return

  try {
    // 从设置读取当前模型路径
    if (window.electronAPI?.getSettings) {
      const settings = await window.electronAPI.getSettings()
      if (settings.currentModel) {
        currentModelPath.value = `/models/${settings.currentModel}/model3.json`
      }
    }

    // 动态导入 Live2DModel（确保在 Cubism SDK 加载后）
    const { Live2DModel } = await import('pixi-live2d-display')

    // 创建 PixiJS 应用（PixiJS 6 使用构造函数初始化；没有 app.init）
    app = new Application({
      view: canvas.value,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    // 本项目的交互（拖拽/点击/视线跟随）由 DOM + Live2D hitTest 处理，不需要 Pixi 的交互插件。
    // 禁用它可以避免 InteractionManager 在某些对象缺少 trackedPointers 时抛异常。
    try {
      const interaction = (app.renderer as any)?.plugins?.interaction
      if (interaction) {
        interaction.destroy()
        ;(app.renderer as any).plugins.interaction = null
      }
      app.stage.interactiveChildren = false
    } catch {
      // ignore
    }

    // 加载 Live2D 模型
    logger.info('开始加载 Live2D 模型:', currentModelPath.value)
    model = await Live2DModel.from(currentModelPath.value)
    logger.info('Live2D 模型加载成功')

    // 加载模型详细信息
    try {
      currentModelInfo.value = await getModelDetails(currentModelPath.value)
    } catch (err) {
      logger.warn('加载模型详细信息失败:', err)
    }

    if (app && model) {
      app.stage.addChild(model)

      // 模型居中和缩放
      setupModel()

      // 根据模型边界调整窗口大小
      adjustWindowSizeToModel()

      // 监听窗口大小变化
      window.addEventListener('resize', handleResize)

      // 添加点击交互
      setupClickInteraction()

      // 初始化智能鼠标穿透
      setupMousePassthrough()

      // 初始化调试画布
      if (debugMode.value) {
        initDebugCanvas()
      }
    }

    loading.value = false
  } catch (err) {
    logger.error('加载 Live2D 模型失败:', err)
    error.value = `加载失败: ${err instanceof Error ? err.message : String(err)}`
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)

  if (passthroughManager) {
    passthroughManager.destroy()
    passthroughManager = null
  }

  if (app) {
    app.destroy(true)
    app = null
  }
  model = null
})

// 设置智能鼠标穿透
const setupMousePassthrough = () => {
  if (!app || !model) return

  // 创建穿透管理器
  passthroughManager = new MousePassthroughManager({
    enabled: true,
    alphaThreshold: 10,
    debounceMs: 20
  })

  // 设置上下文
  passthroughManager.setContext(app, model)

  // 监听鼠标移动
  window.addEventListener('mousemove', handleMouseMove)

  logger.info('智能鼠标穿透已启用')
}

// 暴露给父组件的接口：设置 UI 交互状态
const setUiInteracting = (interacting: boolean) => {
  // if (!passthroughManager) return
  // 不需要锁定逻辑，纯 Bounds 检测
}

// 处理鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (passthroughManager) {
    passthroughManager.handleMouseMove(event)
  }

  if (model && typeof model.focus === 'function') {
    model.focus(event.clientX, event.clientY)
  }

  // 调试：绘制检测区域
  if (debugMode.value && debugCanvas.value && model) {
    drawDebugOverlay(event.clientX, event.clientY)
  }
}

// 绘制调试覆盖层
const drawDebugOverlay = (mouseX: number, mouseY: number) => {
  if (!debugCanvas.value || !model) return

  const ctx = debugCanvas.value.getContext('2d')
  if (!ctx) return

  // 清除画布
  ctx.clearRect(0, 0, debugCanvas.value.width, debugCanvas.value.height)

  // 绘制模型边界框
  const bounds = model.getBounds()
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
  ctx.lineWidth = 2
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)

  // 绘制边界框标签
  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
  ctx.font = '12px monospace'
  ctx.fillText('Model Bounds (getBounds)', bounds.x + 5, bounds.y + 15)

  // 检测当前鼠标位置的 HitArea
  let hitAreas: string[] = []
  if (model.internalModel?.hitTest) {
    hitAreas = model.internalModel.hitTest(mouseX, mouseY) || []
  }

  // 绘制鼠标位置
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
  ctx.beginPath()
  ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2)
  ctx.fill()

  // 绘制鼠标位置信息
  ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'
  ctx.font = '14px monospace'
  ctx.fillText(`Mouse: (${mouseX}, ${mouseY})`, mouseX + 10, mouseY - 10)

  if (hitAreas.length > 0) {
    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'
    ctx.fillText(`HitAreas: ${hitAreas.join(', ')}`, mouseX + 10, mouseY + 10)
  } else {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.9)'
    ctx.fillText('No HitArea', mouseX + 10, mouseY + 10)
  }
}

// 初始化调试画布
const initDebugCanvas = () => {
  if (!debugCanvas.value) return

  debugCanvas.value.width = window.innerWidth
  debugCanvas.value.height = window.innerHeight

  logger.debug('调试画布已初始化')
}

// 设置模型位置和缩放
const setupModel = () => {
  if (!model) return

  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  // 计算缩放比例
  // 在全屏模式下，我们不希望模型铺满整个屏幕，而是保持一个合理的大小
  // 比如高度占屏幕的 50% 或者固定像素高度
  const targetHeight = windowHeight * 0.5 // 占用屏幕高度的 50%
  const scale = targetHeight / model.height

  model.scale.set(scale)

  // 居中
  // 注意：Live2D 模型的原点通常在中心，但也可能在左上角，取决于模型制作
  // pixi-live2d-display 加载的模型通常以中心为锚点（如果内部做了处理），或者我们需要手动调整锚点
  // 这里假设我们需要手动居中

  // 尝试设置锚点到中心（如果支持）
  if (model.anchor) {
    model.anchor.set(0.5, 0.5)
  }

  // 小窗模式：模型固定在窗口内（底部居中）
  model.x = windowWidth * 0.5
  model.y = windowHeight - (model.height * 0.5)
}

// 根据模型边界调整窗口大小
const adjustWindowSizeToModel = async () => {
  if (!model || !window.electronAPI) return

  try {
    // 获取模型的本地边界（相对于模型自身的坐标系）
    const bounds = model.getLocalBounds()

    // 计算实际显示大小（考虑缩放）
    const scale = model.scale.x
    const actualWidth = bounds.width * scale
    const actualHeight = bounds.height * scale

    // 计算窗口大小（添加一些边距）
    const padding = 40
    const windowWidth = Math.ceil(actualWidth + padding * 2)
    const windowHeight = Math.ceil(actualHeight + padding * 2)

    // 调整窗口大小
    await window.electronAPI.setWindowSize(windowWidth, windowHeight)

    logger.debug(`根据模型边界调整窗口大小: ${windowWidth}x${windowHeight} (模型边界: ${bounds.width}x${bounds.height}, 缩放: ${scale})`)
  } catch (error) {
    logger.error('调整窗口大小失败:', error)
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (!app || !canvas.value) return

  const width = window.innerWidth
  const height = window.innerHeight

  app.renderer.resize(width, height)
  setupModel()

  // 调整调试画布大小
  if (debugMode.value && debugCanvas.value) {
    debugCanvas.value.width = width
    debugCanvas.value.height = height
  }
}

// 设置点击交互和拖拽
const setupClickInteraction = () => {
  if (!model || !canvasContainer.value) return

  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let dragStartScreenX = 0
  let dragStartScreenY = 0
  let modelStartX = 0
  let modelStartY = 0
  let clickTime = 0
  let downHitAreas: string[] = []
  let downX = 0
  let downY = 0
  let windowStartX = 0
  let windowStartY = 0

  // 鼠标按下
  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return
    if (!model) return

    const x = event.clientX
    const y = event.clientY

    // 检查是否在模型区域内
    // 优先使用 model.hitTest (处理了坐标变换)，如果不存在则回退到 internalModel.hitTest
    let hitAreas: string[] = []
    if (typeof model.hitTest === 'function') {
      hitAreas = model.hitTest(x, y)
    } else if (model.internalModel?.hitTest) {
      hitAreas = model.internalModel.hitTest(x, y)
    }
    
    const isInModel = hitAreas && hitAreas.length > 0

    if (isInModel) {
      logger.debug('命中区域:', hitAreas)
      clickTime = Date.now()
      downHitAreas = hitAreas
      downX = x
      downY = y
      dragStartX = x
      dragStartY = y
      // 关键：窗口拖拽必须用屏幕坐标，否则窗口移动会导致 client 坐标反向变化，引发抖动
      dragStartScreenX = event.screenX
      dragStartScreenY = event.screenY
      modelStartX = model.x
      modelStartY = model.y

      // 小窗拖拽：记录窗口起始位置
      if (window.electronAPI?.getWindowPosition) {
        window.electronAPI.getWindowPosition().then((pos) => {
          windowStartX = pos.x
          windowStartY = pos.y
        })
      }
      
      // 拖拽期间锁定为“拦截模式”，否则鼠标移出模型后窗口会穿透，导致收不到 mouseup（无法保存位置）
      if (passthroughManager) {
        passthroughManager.setEnabled(false)
        passthroughManager.forceState('intercept')
      }
    }
  })

  // 鼠标移动
  window.addEventListener('mousemove', (event) => {
    if (!isDragging && clickTime > 0) {
      const moveDistance = Math.sqrt(
        Math.pow(event.screenX - dragStartScreenX, 2) +
        Math.pow(event.screenY - dragStartScreenY, 2)
      )

      // 移动超过5像素才开始拖拽
      if (moveDistance > 5) {
        isDragging = true
        logger.debug('开始拖拽模型')
      }
    }

    if (isDragging && model) {
      const deltaX = event.screenX - dragStartScreenX
      const deltaY = event.screenY - dragStartScreenY

      // 小窗模式：移动窗口而不是移动模型
      if (window.electronAPI?.setWindowPosition) {
        window.electronAPI.setWindowPosition(windowStartX + deltaX, windowStartY + deltaY)
      } else {
        // fallback：如果没有 IPC，就在窗口内移动模型
        model.x = modelStartX + deltaX
        model.y = modelStartY + deltaY
      }
    }
  })

  // 鼠标松开
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return
    if (clickTime > 0) {
      const now = Date.now()
      let openedInput = false
      // 如果不是拖拽，且时间很短，则视为点击
      if (!isDragging && (now - clickTime < 300)) {
        // 初期联调：只要点击命中模型任意部位，就弹出输入框
        openedInput = true
        emit('model-input', { x: downX, y: downY, hitAreas: downHitAreas })
      }

      // 小窗模式下，窗口位置已由主进程持久化（见 electron/main.cjs 的 moved/resize 监听）

      // 恢复穿透管理（如果点击打开了输入框，则保持锁定拦截，交给 UI 关闭时恢复）
      if (passthroughManager) {
        if (openedInput) {
          passthroughManager.setEnabled(false)
          passthroughManager.forceState('intercept')
        } else {
          passthroughManager.setEnabled(true)
          passthroughManager.handleMouseMove(event)
        }
      }

      clickTime = 0
      isDragging = false
    }
  })
}




// 播放动作
const playMotion = (group: string, index?: number) => {
  if (model) {
    try {
      model.motion(group, index)
      logger.debug(`播放动作: ${group} ${index ?? 'random'}`)
    } catch (err) {
      logger.error(`播放动作失败: ${group}`, err)
    }
  }
}

// 设置表情
const setExpression = (expressionId: string) => {
  if (model) {
    try {
      model.expression(expressionId)
      logger.debug(`设置表情: ${expressionId}`)
    } catch (err) {
      logger.error(`设置表情失败: ${expressionId}`, err)
    }
  }
}

// 获取模型信息
const getModelInfo = () => {
  if (!model) return null

  return {
    width: model.width,
    height: model.height,
    scale: model.scale.x,
    position: { x: model.x, y: model.y },
    modelInfo: currentModelInfo.value
  }
}

// 重新加载模型（支持热切换）
const reloadModel = async (modelName: string) => {
  if (!app) {
    logger.error('PixiJS 应用未初始化')
    return { success: false, error: 'PixiJS 应用未初始化' }
  }

  loading.value = true
  error.value = ''

  try {
    const newModelPath = `/models/${modelName}/model3.json`
    logger.info('重新加载模型:', newModelPath)

    const { Live2DModel } = await import('pixi-live2d-display')

    // 移除旧模型
    if (model && app.stage) {
      app.stage.removeChild(model)
      model.destroy()
    }

    // 加载新模型
    model = await Live2DModel.from(newModelPath)
    logger.info('新模型加载成功')

    // 加载模型详细信息
    try {
      currentModelInfo.value = await getModelDetails(newModelPath)
    } catch (err) {
      logger.warn('加载模型详细信息失败:', err)
    }

    // 添加到舞台
    app.stage.addChild(model)

    // 重新设置模型位置和缩放
    setupModel()

    // 更新当前路径
    currentModelPath.value = newModelPath

    loading.value = false
    return { success: true }
  } catch (err) {
    logger.error('重新加载模型失败:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `加载失败: ${errorMessage}`
    loading.value = false
    return { success: false, error: errorMessage }
  }
}

// 暴露方法给父组件
defineExpose({
  playMotion,
  setExpression,
  getModelInfo,
  setUiInteracting,
  reloadModel
})
</script>

<style scoped>
.live2d-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.debug-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 100;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-overlay p {
  font-size: 18px;
  text-align: center;
  padding: 20px;
}

.loading-overlay p {
  font-size: 16px;
}
</style>

<template>
  <div ref="canvasContainer" class="live2d-container">
    <canvas ref="canvas"></canvas>

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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application } from 'pixi.js'
import { MousePassthroughManager } from '../utils/mousePassthrough'
import { getModelInfo as getModelDetails, type ParsedModelInfo } from '../utils/modelLoader'
import { logger } from '../utils/logger'
import { motionService, idleMotions } from '../services/motionManagement'

const emit = defineEmits<{
  (e: 'model-input', payload: { x: number; y: number; hitAreas: string[] }): void
}>()

// 确保使用 Cubism 4
if (window.PIXI) {
  (window as any).PIXI = window.PIXI
}

const canvasContainer = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()

let app: Application | null = null
let model: any = null
const modelCache = new Map<string, any>() // 模型缓存
let passthroughManager: MousePassthroughManager | null = null
let modelBaseBounds: { width: number; height: number } | null = null
let customIdleTimer: number | null = null
let motionFinishListener: ((...args: any[]) => void) | null = null

const loading = ref(true)
const error = ref('')
const currentModelPath = ref('/models/default/model3.json')
const currentModelName = ref('default')
const currentModelInfo = ref<ParsedModelInfo | null>(null)

const modelSettings = ref({
  modelScale: 1.0,
  modelX: 0,
  modelY: 0,
  eyeTracking: true,
  clickFeedback: true,
  dragEnabled: true,
  passthroughEnabled: true,
  alphaThreshold: 10,
  debounceMs: 50
})
let mouseMoveListenerAttached = false
let settingsCleanup: (() => void) | null = null

const UI_HIT_SELECTORS = [
  '.input-popup',
  '.bubble-dialog',
  '.attachment-preview',
  '.image-display'
]

const isUiElement = (element: Element | null) => {
  if (!element) return false
  return UI_HIT_SELECTORS.some((selector) => element.closest(selector))
}

const isUiHitAtPoint = (x: number, y: number) => {
  const element = document.elementFromPoint(x, y)
  return isUiElement(element)
}

onMounted(async () => {
  if (!canvas.value || !canvasContainer.value) return

  try {
    // 从设置读取当前模型路径
    if (window.electronAPI?.getSettings) {
      const settings = await window.electronAPI.getSettings()
      if (settings.currentModel) {
        currentModelPath.value = `/models/${settings.currentModel}/model3.json`
        currentModelName.value = settings.currentModel
      }
      applySettings(settings)
    }

    // 动态导入 Live2DModel（确保在 Cubism SDK 加载后）
    const { Live2DModel } = await import('pixi-live2d-display')

    // 创建 PixiJS 应用，优化性能设置
    app = new Application({
      view: canvas.value,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      // 性能优化设置
      powerPreference: 'high-performance',
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

    // 加载 Live2D 模型（使用缓存）
    logger.info('开始加载 Live2D 模型:', currentModelPath.value)
    
    if (modelCache.has(currentModelPath.value)) {
      model = modelCache.get(currentModelPath.value)
      logger.info('从缓存加载 Live2D 模型')
    } else {
      model = await Live2DModel.from(currentModelPath.value)
      modelCache.set(currentModelPath.value, model)
      logger.info('Live2D 模型加载成功并缓存')
    }
    
    modelBaseBounds = model.getLocalBounds()

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



      // 监听窗口大小变化
      window.addEventListener('resize', handleResize)

      // 添加点击交互
      setupClickInteraction()

      // 初始化智能鼠标穿透
      setupMousePassthrough()


    }

    if (window.electronAPI?.onSettingsChanged) {
      settingsCleanup = window.electronAPI.onSettingsChanged((nextSettings) => {
        applySettings(nextSettings)
      })
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

  if (settingsCleanup) {
    settingsCleanup()
    settingsCleanup = null
  }

  // 清理模型缓存
  modelCache.clear()

  if (app) {
    // 先停止所有动画和渲染
    app.stop()
    app.ticker.stop()
    
    // 销毁应用
    app.destroy(true, { children: true, texture: true, baseTexture: true })
    app = null
  }
  model = null
})

const applySettings = async (settings?: any) => {
  if (!settings) return

  const passthroughEnabled =
    settings.passthroughEnabled ??
    settings.mousePassthrough?.enabled ??
    modelSettings.value.passthroughEnabled
  const alphaThreshold =
    settings.alphaThreshold ??
    settings.mousePassthrough?.alphaThreshold ??
    modelSettings.value.alphaThreshold
  const debounceMs = settings.debounceMs ?? modelSettings.value.debounceMs

  modelSettings.value = {
    ...modelSettings.value,
    modelScale: Number.isFinite(settings.modelScale) ? settings.modelScale : modelSettings.value.modelScale,
    modelX: Number.isFinite(settings.modelX) ? settings.modelX : modelSettings.value.modelX,
    modelY: Number.isFinite(settings.modelY) ? settings.modelY : modelSettings.value.modelY,
    eyeTracking: settings.eyeTracking ?? modelSettings.value.eyeTracking,
    clickFeedback: settings.clickFeedback ?? modelSettings.value.clickFeedback,
    dragEnabled: settings.dragEnabled ?? modelSettings.value.dragEnabled,
    passthroughEnabled,
    alphaThreshold: Number.isFinite(alphaThreshold) ? alphaThreshold : modelSettings.value.alphaThreshold,
    debounceMs: Number.isFinite(debounceMs) ? debounceMs : modelSettings.value.debounceMs
  }

  if (settings.currentModel && settings.currentModel !== currentModelName.value) {
    await reloadModel(settings.currentModel)
  }

    if (model) {
      setupModel()
      updateMousePassthrough()
    }
}

// 设置智能鼠标穿透
const setupMousePassthrough = () => {
  if (!app || !model) return

  // 创建穿透管理器
  if (passthroughManager) {
    passthroughManager.destroy()
  }
  passthroughManager = new MousePassthroughManager({
    enabled: modelSettings.value.passthroughEnabled,
    alphaThreshold: modelSettings.value.alphaThreshold,
    debounceMs: modelSettings.value.debounceMs,
    uiHitTest: isUiHitAtPoint
  })

  // 设置上下文
  passthroughManager.setContext(app, model)

  // 监听鼠标移动
  if (!mouseMoveListenerAttached) {
    window.addEventListener('mousemove', handleMouseMove)
    mouseMoveListenerAttached = true
  }

  // 初始化状态同步，避免外部设置导致穿透状态卡死
  void passthroughManager.syncWithCursor()

  logger.info('智能鼠标穿透已启用')
}

const updateMousePassthrough = () => {
  if (!app || !model) return
  setupMousePassthrough()
}

// 暴露给父组件的接口：设置 UI 交互状态
const setUiInteracting = (interacting: boolean) => {
  // if (!passthroughManager) return
  // 不需要锁定逻辑，纯 Bounds 检测
  void interacting
}

// 节流函数
const createThrottle = (func: Function, delay: number) => {
  let lastCall = 0
  return (...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func.apply(this, args)
    }
  }
}

// 处理鼠标移动（节流优化）
const handleMouseMove = createThrottle((event: MouseEvent) => {
  if (passthroughManager) {
    passthroughManager.handleMouseMove(event)
  }

  if (modelSettings.value.eyeTracking && model && typeof model.focus === 'function') {
    model.focus(event.clientX, event.clientY)
  }
}, modelSettings.value.debounceMs || 16) // 约60fps

const setupIdleStrategy = () => {
  if (!model) return

  const randomEnabled = localStorage.getItem('idle_random_enabled') !== 'false'
  const hasCustomIdle = (idleMotions.value && idleMotions.value.length > 0) || !randomEnabled
  
  // 先停止现有的自定义循环
  stopCustomIdleLoop()

  if (hasCustomIdle) {
    // 禁用默认待机动作
    model.autoplay = false
    logger.info('启用自定义待机动作策略')
    
    // 启动自定义循环
    startCustomIdleLoop()
  } else {
    // 启用默认待机动作
    model.autoplay = true
    logger.info('启用默认待机动作策略')
  }
}

const startCustomIdleLoop = () => {
  if (!model) return

  // 监听动作结束事件
  motionFinishListener = () => {
    scheduleNextIdle()
  }
  
  model.on('motionFinish', motionFinishListener)
  
  // 启动循环
  scheduleNextIdle()
}

const stopCustomIdleLoop = () => {
  if (customIdleTimer) {
    clearTimeout(customIdleTimer)
    customIdleTimer = null
  }
  if (model && motionFinishListener) {
    model.off('motionFinish', motionFinishListener)
    motionFinishListener = null
  }
}

const scheduleNextIdle = () => {
  if (customIdleTimer) clearTimeout(customIdleTimer)
  
  // 从 localStorage 读取配置 (暂定，后续应移至 motionService 或 settings)
  const intervalStr = localStorage.getItem('idle_motion_interval')
  const interval = parseInt(intervalStr || '10') * 1000
  const randomEnabled = localStorage.getItem('idle_random_enabled') !== 'false'
  
  if (!randomEnabled && idleMotions.value.length === 0) return

  customIdleTimer = window.setTimeout(() => {
    // 检查模型是否存在且没有在播放高优先级动作
    if (!model) return
    
    // 简单检查：如果 internalModel 存在
    const motion = motionService.getRandomIdleMotion()
    if (motion) {
        // 使用优先级 0 (IDLE) 播放
        playMotion(motion.groupId, motion.index, 0)
    }
  }, interval)
}

watch(idleMotions, () => {
  setupIdleStrategy()
}, { deep: true })

// 设置模型位置和缩放
const setupModel = () => {
  if (!model) return

  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const baseBounds = modelBaseBounds ?? model.getLocalBounds()
  const baseHeight = Math.max(baseBounds.height || 0, 1)

  // 计算缩放比例 - 适配更小的窗口尺寸
  // 针对桌面宠物设计：模型应占据窗口的大部分空间但留有边距
  const targetHeight = Math.min(windowHeight * 0.85, 300) // 限制最大高度为300px
  const targetWidth = Math.min(windowWidth * 0.85, 250) // 限制最大宽度为250px
  const heightScale = targetHeight / baseHeight
  const widthScale = targetWidth / Math.max(baseBounds.width || 1, 1)
  const baseScale = Math.min(heightScale, widthScale) // 选择较小的缩放比例确保完整显示
  const scale = baseScale * (modelSettings.value.modelScale || 1)

  model.scale.set(scale)

  // 居中
  // 注意：Live2D 模型的原点通常在中心，但也可能在左上角，取决于模型制作
  // pixi-live2d-display 加载的模型通常以中心为锚点（如果内部做了处理），或者我们需要手动调整锚点
  // 这里假设我们需要手动居中

  // 尝试设置锚点到中心（如果支持）
  if (model.anchor) {
    model.anchor.set(0.5, 0.5)
  }

  // 桌面宠物模式：模型居中显示，适合小窗口
  const scaledHeight = baseHeight * scale
  const scaledWidth = (baseBounds.width || 1) * scale
  
  // 居中显示，考虑用户偏移设置
  model.x = windowWidth * 0.5 + (modelSettings.value.modelX || 0)
  model.y = windowHeight * 0.5 + (modelSettings.value.modelY || 0)
  
  // 确保模型完全在窗口内显示
  const padding = 20
  model.x = Math.max(padding + scaledWidth * 0.5, Math.min(windowWidth - padding - scaledWidth * 0.5, model.x))
  model.y = Math.max(padding + scaledHeight * 0.5, Math.min(windowHeight - padding - scaledHeight * 0.5, model.y))

  // 初始化待机策略
  setupIdleStrategy()
}



// 防抖函数
const createDebounce = (func: Function, delay: number) => {
  let timeoutId: number | null = null
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(() => {
      func.apply(this, args)
      timeoutId = null
    }, delay)
  }
}

// 处理窗口大小变化（防抖优化）
const handleResize = createDebounce(() => {
  if (!app || !canvas.value) return

  const width = window.innerWidth
  const height = window.innerHeight

  app.renderer.resize(width, height)
  setupModel()
}, 150) // 150ms防抖

// 设置点击交互和拖拽
const setupClickInteraction = () => {
  if (!model || !canvasContainer.value) return

  let isDragging = false
  let passthroughLocked = false

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

  const isUiTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    return isUiElement(target)
  }

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

    if (!isInModel) {
      if (passthroughManager && !isUiTarget(event.target)) {
        passthroughLocked = true
        passthroughManager.lock('passthrough')
      }
      return
    }

    if (isInModel) {
      logger.debug('命中区域:', hitAreas)
      clickTime = Date.now()
      downHitAreas = hitAreas
      downX = x
      downY = y

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
    if (!isDragging && clickTime > 0 && modelSettings.value.dragEnabled) {
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

    if (isDragging && model && modelSettings.value.dragEnabled) {
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

    if (passthroughLocked) {
      passthroughLocked = false
      passthroughManager?.unlock(event)
      return
    }

    passthroughManager?.unlock(event)

    if (clickTime > 0) {
      const now = Date.now()
      let openedInput = false
      // 如果不是拖拽，且时间很短，则视为点击
      if (!isDragging && (now - clickTime < 300) && modelSettings.value.clickFeedback) {
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
const playMotion = (group: string, index?: number, priority?: number) => {
  if (model) {
    try {
      model.motion(group, index, priority)
      logger.debug(`播放动作: ${group} ${index ?? 'random'} (priority=${priority ?? '-'})`)
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

// 停止所有动作
const stopMotion = () => {
  const manager = model?.internalModel?.motionManager
  if (manager && typeof manager.stopAllMotions === 'function') {
    manager.stopAllMotions()
    return true
  }
  return false
}

// 重置表情（尽力恢复为默认状态）
const resetExpression = () => {
  if (!model) return false
  try {
    model.expression('')
    return true
  } catch (err) {
    logger.error('重置表情失败:', err)
    return false
  }
}

// 设置模型参数
const setParameter = (name: string, value: number, blend?: number) => {
  if (!model?.internalModel?.coreModel?.setParameterValueById) return false
  try {
    const coreModel = model.internalModel.coreModel
    let nextValue = value
    if (typeof blend === 'number' && coreModel.getParameterValueById) {
      const current = coreModel.getParameterValueById(name)
      nextValue = current + (value - current) * blend
    }
    coreModel.setParameterValueById(name, nextValue)
    logger.debug(`设置参数: ${name}=${nextValue}`)
    return true
  } catch (err) {
    logger.error(`设置参数失败: ${name}`, err)
    return false
  }
}

// 模型注视控制
const lookAt = (x: number, y: number, smooth: boolean = true) => {
  if (!model || typeof model.focus !== 'function') return false
  const normalizedX = Math.abs(x) <= 1 ? (x >= 0 ? x : (x + 1) / 2) : null
  const normalizedY = Math.abs(y) <= 1 ? (y >= 0 ? y : (y + 1) / 2) : null
  const targetX = normalizedX !== null ? normalizedX * window.innerWidth : x
  const targetY = normalizedY !== null ? normalizedY * window.innerHeight : y
  try {
    model.focus(targetX, targetY, !smooth)
    return true
  } catch (err) {
    logger.error('注视控制失败:', err)
    return false
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

// 卸载模型（仅清理当前实例）
const unloadModel = async () => {
  if (!app) {
    return { success: false, error: 'PixiJS 应用未初始化' }
  }
  try {
    if (model && app.stage) {
      app.stage.removeChild(model)
      model.destroy()
    }
    model = null
    modelBaseBounds = null
    currentModelInfo.value = null
    currentModelName.value = ''
    currentModelPath.value = ''
    loading.value = false
    return { success: true }
  } catch (err) {
    logger.error('卸载模型失败:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
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

    // 加载新模型（使用缓存）
    if (modelCache.has(newModelPath)) {
      model = modelCache.get(newModelPath)
      logger.info('从缓存加载新模型')
    } else {
      model = await Live2DModel.from(newModelPath)
      modelCache.set(newModelPath, model)
      logger.info('新模型加载成功并缓存')
    }
    
    modelBaseBounds = model.getLocalBounds()

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
    updateMousePassthrough()
    adjustWindowSizeToModel()

    // 更新当前路径
    currentModelPath.value = newModelPath
    currentModelName.value = modelName

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

// 监听跨窗口配置变化
onMounted(() => {
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'idle_random_enabled' || e.key === 'idle_motion_interval') {
    setupIdleStrategy()
    // 如果间隔改变，重启循环
    if (e.key === 'idle_motion_interval') {
      scheduleNextIdle()
    }
  }
}

// 暴露方法给父组件
defineExpose({
  playMotion,
  setExpression,
  stopMotion,
  resetExpression,
  setParameter,
  lookAt,
  getModelInfo,
  setUiInteracting,
  reloadModel,
  unloadModel
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

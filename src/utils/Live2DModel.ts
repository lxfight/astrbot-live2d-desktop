/**
 * Live2D 模型类
 * 基于 pixi-live2d-display 实现
 */

/// <reference types="pixi.js" />

import * as PIXI from 'pixi.js'
import { Live2DModel as PixiLive2DModel } from 'pixi-live2d-display'
import { createNoise2D } from 'simplex-noise'

// 将 PIXI 挂载到 window，供 pixi-live2d-display 使用
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI
}

// 抑制 pixi-live2d-display 内部的 PIXI v7 弃用警告
// 这是库本身的问题，等待官方更新
const originalWarn = console.warn
console.warn = function(...args: any[]) {
  const message = args[0]
  if (typeof message === 'string' && message.includes('renderer.plugins.interaction has been deprecated')) {
    return
  }
  originalWarn.apply(console, args)
}

export class Live2DModel {
  private static app: any = null  // 共享的 PIXI Application
  private static canvas: HTMLCanvasElement | null = null
  private model: any = null
  private modelPath: string = ''

  /**
   * 获取内部 PIXI Live2DModel 实例
   */
  get pixiModel(): any {
    return this.model
  }

  /**
   * 从配置文件加载模型
   */
  static async from(modelPath: string): Promise<Live2DModel> {
    const instance = new Live2DModel()
    await instance.load(modelPath)
    return instance
  }

  /**
   * 加载模型
   */
  async load(modelPath: string): Promise<void> {
    this.modelPath = modelPath

    try {
      this.model = await PixiLive2DModel.from(modelPath, {
        autoInteract: false
      })

      console.log('[Live2D] 模型加载完成:', modelPath)
    } catch (error) {
      console.error('[Live2D] 模型加载失败:', error)
      throw error
    }
  }

  // 待机动作相关
  private noise2D = createNoise2D()
  private idleMotionTime = 0
  private idleMotionEnabled = true
  private idleMotionAnimationId: number | null = null

  /**
   * 初始化 WebGL（创建共享的 PIXI Application）
   */
  initWebGL(canvas: HTMLCanvasElement, initialPosition?: { x: number; y: number }): void {
    if (!this.model) {
      throw new Error('模型未加载')
    }

    // 如果 Application 不存在，创建它
    if (!Live2DModel.app) {
      console.log('[Live2D] 创建 PIXI Application...')
      Live2DModel.canvas = canvas

      Live2DModel.app = new PIXI.Application({
        view: canvas,
        width: canvas.width,
        height: canvas.height,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        // 性能优化选项
        powerPreference: 'high-performance', // 使用高性能 GPU
        preserveDrawingBuffer: false, // 不保留绘图缓冲区，避免 ReadPixels
        clearBeforeRender: true,
        // PIXI v7 禁用事件系统
        eventMode: 'none'
      })
    }

    // 清空舞台上的所有内容
    Live2DModel.app.stage.removeChildren()

    // 调整模型大小和位置
    const scale = Math.min(
      canvas.width / this.model.width,
      canvas.height / this.model.height
    ) * 0.3  // 缩放系数：0.3 = 占屏幕 30%

    this.model.scale.set(scale)

    // 使用传入的初始位置，如果没有则使用画布中心
    if (initialPosition) {
      this.model.x = initialPosition.x
      this.model.y = initialPosition.y
      console.log('[Live2D] 使用保存的位置:', initialPosition)
    } else {
      this.model.x = canvas.width / 2
      this.model.y = canvas.height / 2
      console.log('[Live2D] 使用默认中心位置')
    }
    this.model.anchor.set(0.5, 0.5)

    // 添加到舞台
    Live2DModel.app.stage.addChild(this.model)

    console.log('[Live2D] 模型已添加到舞台')
  }

  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    if (!Live2DModel.app || !this.model) return

    // 调整渲染器大小
    Live2DModel.app.renderer.resize(width, height)

    // 重新计算模型缩放和位置
    const scale = Math.min(
      width / this.model.width,
      height / this.model.height
    ) * 0.3  // 缩放系数：0.3 = 占屏幕 30%

    this.model.scale.set(scale)
    this.model.x = width / 2
    this.model.y = height / 2
  }

  /**
   * 更新模型（空实现，PIXI 自动处理）
   */
  update(deltaTime: number): void {
    // pixi-live2d-display 会自动更新模型
  }

  /**
   * 渲染模型（空实现，PIXI 自动渲染）
   */
  render(): void {
    // PIXI Application 自动处理渲染
  }

  /**
   * 播放动作
   */
  motion(group: string, index: number = 0): void {
    if (!this.model) return

    try {
      this.model.motion(group, index)
      console.log(`[Live2D] 播放动作: ${group}[${index}]`)
    } catch (error) {
      console.warn(`[Live2D] 动作播放失败: ${group}[${index}]`, error)
    }
  }

  /**
   * 设置表情
   */
  expression(expressionId: string | number): void {
    if (!this.model) return

    try {
      this.model.expression(expressionId)
      console.log(`[Live2D] 设置表情: ${expressionId}`)
    } catch (error) {
      console.warn(`[Live2D] 表情设置失败: ${expressionId}`, error)
    }
  }

  /**
   * 开始口型同步
   */
  startLipSync(audioElement: HTMLAudioElement): void {
    if (!this.model) return

    try {
      // 检查模型是否支持口型同步
      const internalModel = this.model.internalModel
      if (!internalModel) {
        console.warn('[Live2D] 模型不支持口型同步')
        return
      }

      // 创建音频上下文和分析器
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      // 连接音频源
      const source = audioContext.createMediaElementSource(audioElement)
      source.connect(analyser)
      analyser.connect(audioContext.destination)

      // 口型同步参数名称（不同模型可能不同）
      const lipSyncParams = [
        'ParamMouthOpenY',  // Cubism 4 标准参数
        'PARAM_MOUTH_OPEN_Y', // Cubism 2 标准参数
        'mouth_open_y',
        'MouthOpenY'
      ]

      // 找到模型支持的口型参数
      let lipSyncParamIndex = -1
      for (const paramName of lipSyncParams) {
        try {
          if (internalModel.coreModel) {
            // Cubism 4
            const paramIndex = internalModel.coreModel.getParameterIndex(paramName)
            if (paramIndex >= 0) {
              lipSyncParamIndex = paramIndex
              console.log(`[Live2D] 使用口型参数: ${paramName}`)
              break
            }
          } else if (internalModel.getParamIndex) {
            // Cubism 2
            const paramIndex = internalModel.getParamIndex(paramName)
            if (paramIndex >= 0) {
              lipSyncParamIndex = paramIndex
              console.log(`[Live2D] 使用口型参数: ${paramName}`)
              break
            }
          }
        } catch (e) {
          // 参数不存在，继续尝试下一个
        }
      }

      if (lipSyncParamIndex < 0) {
        console.warn('[Live2D] 未找到口型参数，无法进行口型同步')
        return
      }

      // 口型同步动画循环
      const updateLipSync = () => {
        if (audioElement.paused || audioElement.ended) {
          // 音频停止，重置口型
          this.setLipSyncValue(0)
          return
        }

        // 获取音频频率数据
        analyser.getByteFrequencyData(dataArray)

        // 计算平均音量（0-255）
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength

        // 将音量映射到口型开合度（0-1）
        const lipSyncValue = Math.min(average / 128, 1.0)

        // 设置口型参数
        this.setLipSyncValue(lipSyncValue)

        // 继续下一帧
        requestAnimationFrame(updateLipSync)
      }

      // 开始口型同步
      console.log('[Live2D] 开始口型同步')
      updateLipSync()

      // 音频结束时清理
      audioElement.addEventListener('ended', () => {
        this.setLipSyncValue(0)
        audioContext.close()
        console.log('[Live2D] 口型同步结束')
      }, { once: true })

    } catch (error) {
      console.error('[Live2D] 口型同步初始化失败:', error)
    }
  }

  /**
   * 设置口型参数值
   */
  private setLipSyncValue(value: number): void {
    if (!this.model) return

    try {
      const internalModel = this.model.internalModel
      if (!internalModel) return

      // 口型参数名称列表
      const lipSyncParams = [
        'ParamMouthOpenY',
        'PARAM_MOUTH_OPEN_Y',
        'mouth_open_y',
        'MouthOpenY'
      ]

      // 尝试设置口型参数
      for (const paramName of lipSyncParams) {
        try {
          if (internalModel.coreModel) {
            // Cubism 4
            const paramIndex = internalModel.coreModel.getParameterIndex(paramName)
            if (paramIndex >= 0) {
              internalModel.coreModel.setParameterValueById(paramName, value)
              return
            }
          } else if (internalModel.setParamFloat) {
            // Cubism 2
            internalModel.setParamFloat(paramName, value)
            return
          }
        } catch (e) {
          // 参数不存在，继续尝试下一个
        }
      }
    } catch (error) {
      // 忽略错误，避免频繁输出
    }
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): {
    name: string;
    motionGroups: Record<string, Array<{ index: number; file: string }>>;
    expressions: string[]
  } {
    if (!this.model) {
      return { name: '', motionGroups: {}, expressions: [] }
    }

    const motionGroups: Record<string, Array<{ index: number; file: string }>> = {}
    const expressions: string[] = []

    try {
      // 获取动作组列表及每个动作的详细信息
      const internalModel = this.model.internalModel
      if (internalModel && internalModel.motionManager) {
        const motionManager = internalModel.motionManager

        // Cubism 2
        if (motionManager.definitions) {
          Object.keys(motionManager.definitions).forEach(group => {
            const motions = motionManager.definitions[group]
            if (Array.isArray(motions)) {
              motionGroups[group] = motions.map((motion: any, index: number) => ({
                index,
                file: motion.file || `motion_${index}`
              }))
            }
          })
        }

        // Cubism 4
        if (motionManager.groups) {
          Object.keys(motionManager.groups).forEach(group => {
            const motions = motionManager.groups[group]
            if (Array.isArray(motions)) {
              motionGroups[group] = motions.map((motion: any, index: number) => ({
                index,
                file: motion.File || `motion_${index}`
              }))
            }
          })
        }
      }

      // 获取表情列表
      if (internalModel && internalModel.expressionManager) {
        const expressionManager = internalModel.expressionManager

        // Cubism 2
        if (expressionManager.definitions) {
          expressionManager.definitions.forEach((expr: any, index: number) => {
            const name = expr.name || `expression_${index}`
            expressions.push(name)
          })
        }

        // Cubism 4
        if (expressionManager.expressions) {
          expressionManager.expressions.forEach((expr: any, index: number) => {
            const name = expr.name || `expression_${index}`
            expressions.push(name)
          })
        }
      }

      console.log('[Live2D] 模型信息:', { motionGroups, expressions })
    } catch (error) {
      console.warn('[Live2D] 获取模型信息失败:', error)
    }

    // 提取模型名称
    const modelName = this.modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown'

    return {
      name: modelName,
      motionGroups,
      expressions
    }
  }

  /**
   * 获取模型纹理源（用于颜色提取）
   */
  getTextureSource(): HTMLImageElement | null {
    if (!this.model) return null

    try {
      // 尝试从内部模型获取纹理
      // pixi-live2d-display 可能会将纹理存储在 internalModel 中
      const internalModel = this.model.internalModel
      if (internalModel && internalModel.coreModel) {
        // Cubism 4 or 2
        // 这里比较复杂，我们尝试直接从 PIXI DisplayObject 的 textures 获取
        // 通常 model.textures 包含了所有纹理
        const textures = (this.model as any).textures
        if (Array.isArray(textures) && textures.length > 0) {
          const texture = textures[0]
          if (texture.baseTexture && texture.baseTexture.resource && texture.baseTexture.resource.source) {
            return texture.baseTexture.resource.source as HTMLImageElement
          }
        }
      }
    } catch (e) {
      console.warn('[Live2D] 获取模型纹理失败:', e)
    }
    return null
  }

  /**
   * 销毁模型（仅移除模型，保留 Application）
   */
  destroy(): void {
    console.log('[Live2D] 移除模型...')

    // 从舞台移除模型
    if (this.model && Live2DModel.app && Live2DModel.app.stage) {
      try {
        Live2DModel.app.stage.removeChild(this.model)
        if (this.model.destroy) {
          this.model.destroy({ children: true })
        }
      } catch (error) {
        console.warn('[Live2D] 移除模型时出错:', error)
      }
    }

    // 清空模型引用
    this.model = null
    this.modelPath = ''

    console.log('[Live2D] 模型已移除')
  }

  /**
   * 销毁整个应用（仅在程序退出时调用）
   */
  static destroyApp(): void {
    if (Live2DModel.app) {
      console.log('[Live2D] 销毁 PIXI Application...')
      try {
        Live2DModel.app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true
        })
      } catch (error) {
        console.warn('[Live2D] 销毁应用时出错:', error)
      }
      Live2DModel.app = null
      Live2DModel.canvas = null
    }
  }
}


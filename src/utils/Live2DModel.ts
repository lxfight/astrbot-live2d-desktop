/**
 * Live2D 模型类
 * 基于 pixi-live2d-display 实现
 */

/// <reference types="pixi.js" />

export class Live2DModel {
  private static app: any = null  // 共享的 PIXI Application
  private static canvas: HTMLCanvasElement | null = null
  private model: any = null
  private modelPath: string = ''

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

    // 动态加载 PIXI.js 和 Live2D SDK
    await this.loadSDK()

    // 使用 pixi-live2d-display 加载模型
    const { Live2DModel: PixiLive2DModel } = (window as any).PIXI.live2d

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

  /**
   * 动态加载 SDK
   */
  private async loadSDK(): Promise<void> {
    const win = window as any

    // 检查是否已加载
    if (win.PIXI && win.PIXI.live2d) {
      return
    }

    console.log('[Live2D] 开始加载 SDK...')

    // 1. 加载 PIXI.js
    if (!win.PIXI) {
      console.log('[Live2D] 加载 PIXI.js...')
      await this.loadScript('https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js')
    }

    // 2. 加载 Cubism 2 运行时（可选，支持旧版 .model.json 模型）
    if (!win.Live2D) {
      try {
        console.log('[Live2D] 加载 Cubism 2 Core...')
        await this.loadScript('https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js')
      } catch (error) {
        console.warn('[Live2D] Cubism 2 运行时加载失败，将仅支持 Cubism 4 模型')
      }
    }

    // 3. 加载 Cubism 4 Core（支持 .model3.json 模型）
    // 注意：官方 CDN 的 Core 版本为 5.1.0，仅支持 moc3 version 5
    // moc3 version 6 需要 Cubism SDK 6.0+，需要手动下载部署
    if (!win.Live2DCubismCore) {
      console.log('[Live2D] 加载 Cubism Core...')
      await this.loadScript('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js')
    }

    // 4. 加载 pixi-live2d-display
    if (!win.PIXI || !win.PIXI.live2d) {
      console.log('[Live2D] 加载 pixi-live2d-display...')
      await this.loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js')
    }

    console.log('[Live2D] SDK 加载完成')
  }

  /**
   * 加载脚本
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
    })
  }

  /**
   * 初始化 WebGL（创建共享的 PIXI Application）
   */
  initWebGL(canvas: HTMLCanvasElement): void {
    const PIXI = (window as any).PIXI

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
        autoDensity: true
      })
    }

    // 清空舞台上的所有内容
    Live2DModel.app.stage.removeChildren()

    // 调整模型大小和位置
    const scale = Math.min(
      canvas.width / this.model.width,
      canvas.height / this.model.height
    ) * 0.8

    this.model.scale.set(scale)
    this.model.x = canvas.width / 2
    this.model.y = canvas.height / 2
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
    ) * 0.8

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


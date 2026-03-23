/**
 * Live2D Cubism Model 类
 * 基于官方 Cubism SDK for Web 实现
 * 
 * 此类使用真实的 Cubism Framework 来加载和渲染 Live2D 模型
 */

import {
  CubismFramework,
  CubismUserModel,
  CubismModelSettingJson,
  CubismRenderer_WebGL,
  CubismMotionManager,
  CubismMotion,
  CubismExpressionMotionManager,
  CubismExpressionMotion,
  CubismEyeBlink,
  CubismBreath,
  CubismPhysics,
  CubismPose,
  CubismMatrix44,
  CubismModelMatrix,
  CubismTargetPoint,
  CubismDefaultParameterId,
  type ICubismModelSetting
} from '../../framework'

import type {
  CubismModelInfo,
  ModelBounds,
  Position
} from './index'

import {
  isCubism3Model,
  getModelName,
  getTexturePath,
  getMotionPath,
  getExpressionPath,
  getPhysicsPath,
  getPosePath
} from './CubismCore'
import { createCubismAllocator } from './CubismAllocator'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 加载状态枚举
 */
export enum LoadStep {
  LoadAssets = 0,
  LoadModel = 1,
  LoadExpression = 2,
  LoadPhysics = 3,
  LoadPose = 4,
  LoadMotion = 5,
  LoadTexture = 6,
  CompleteSetup = 7
}

// ============================================================================
// 常量和枚举
// ============================================================================

/**
 * 动作优先级
 */
export enum MotionPriority {
  None = 0,
  Idle = 1,
  Normal = 2,
  Force = 3
}

// ============================================================================
// Cubism 模型类
// ============================================================================

/**
 * 重新导出 CubismModelSettingJson 和 ICubismModelSetting
 */
export { CubismModelSettingJson, type ICubismModelSetting }

/**
 * Cubism 模型类
 * 提供 Live2D 模型的完整功能
 */
export class CubismModel {
  private static frameworkStarted = false
  private static frameworkInitialized = false
  private static allocator = createCubismAllocator()

  // WebGL 上下文
  private gl: WebGLRenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null

  // Cubism Framework 对象
  private userModel: CubismUserModel | null = null
  private modelSetting: ICubismModelSetting | null = null
  private renderer: CubismRenderer_WebGL | null = null

  // 动画管理器
  private motionManager: CubismMotionManager | null = null
  private expressionManager: CubismExpressionMotionManager | null = null

  // 效果组件
  private eyeBlink: CubismEyeBlink | null = null
  private breath: CubismBreath | null = null
  private physics: CubismPhysics | null = null
  private pose: CubismPose | null = null

  // 状态
  private modelPath: string = ''
  private modelHomeDir: string = ''
  private state: LoadStep = LoadStep.LoadAssets
  private isInitialized: boolean = false
  private isUpdating: boolean = false

  // 口型同步相关
  private lipSyncContext: AudioContext | null = null
  private lipSyncAnalyser: AnalyserNode | null = null
  private lipSyncSource: MediaElementAudioSourceNode | null = null
  private lipSyncAudioElement: HTMLAudioElement | null = null
  private lipSyncFrameId: number | null = null
  private lipSyncEndedHandler: (() => void) | null = null
  private lipSyncValue: number = 0
  private lipSyncParamId: string = 'ParamMouthOpenY'

  // 眼睛注视相关
  private dragManager: CubismTargetPoint = new CubismTargetPoint()

  // 动画相关
  private lastUpdateTime: number = 0
  private deltaTime: number = 0
  private userTimeSeconds: number = 0

  // 矩阵
  private modelMatrix: CubismModelMatrix | null = null
  private projectionMatrix: CubismMatrix44 = new CubismMatrix44()

  // 位置相关
  private modelX: number = 0
  private modelY: number = 0

  // 纹理
  private textures: WebGLTexture[] = []

  // 动作和表情文件
  private motionGroups: Map<string, Array<{ file: string; motion?: CubismMotion }>> = new Map()
  private expressionFiles: Array<{ name: string; file: string; expression?: CubismExpressionMotion }> = []

  // 性能监控
  private frameCount: number = 0
  private fps: number = 0
  private lastFpsUpdate: number = 0

  /**
   * 构造函数
   */
  constructor() {
    CubismModel.ensureFrameworkReady()
    console.log('[CubismModel] 构造函数')
  }

  /**
   * 从配置文件加载模型
   */
  static async from(modelPath: string): Promise<CubismModel> {
    const instance = new CubismModel()
    await instance.load(modelPath)
    return instance
  }

  private static ensureFrameworkReady(): void {
    if (!CubismModel.frameworkStarted) {
      CubismFramework.startUp({
        logFunction: console.log.bind(console),
        loggingLevel: 1
      } as any)
      CubismModel.frameworkStarted = true
    }

    if (!CubismModel.frameworkInitialized) {
      CubismFramework.initialize()
      CubismModel.frameworkInitialized = true
    }
  }

  // ============================================================================
  // 状态获取方法
  // ============================================================================

  getState(): LoadStep {
    return this.state
  }

  getModelPath(): string {
    return this.modelPath
  }

  getModelName(): string {
    return getModelName(this.modelPath)
  }

  getTextureCount(): number {
    return this.textures.length
  }

  getFps(): number {
    return this.fps
  }

  // ============================================================================
  // 模型加载方法
  // ============================================================================

  /**
   * 加载模型
   */
  async load(modelPath: string): Promise<void> {
    this.modelPath = modelPath

    // 检查是否为 Cubism 3 模型
    if (!isCubism3Model(modelPath)) {
      throw new Error('当前版本仅支持 Cubism 3（.model3.json）模型。')
    }

    try {
      console.log('[CubismModel] 开始加载模型:', modelPath)

      // 设置模型主目录
      this.modelHomeDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)

      // 步骤1：加载 model3.json 配置文件
      this.state = LoadStep.LoadAssets
      const modelSettingBuffer = await this.loadFileAsArrayBuffer(modelPath)

      // 创建模型设置对象
      this.modelSetting = new CubismModelSettingJson(
        modelSettingBuffer,
        modelSettingBuffer.byteLength
      )

      // 步骤2：加载 moc3 模型文件
      this.state = LoadStep.LoadModel
      const modelFileName = this.modelSetting.getModelFileName()
      if (!modelFileName) {
        throw new Error('模型配置文件中未指定模型文件名')
      }

      const modelFilePath = this.modelHomeDir + modelFileName
      console.log('[CubismModel] 加载模型文件:', modelFilePath)

      const mocBuffer = await this.loadFileAsArrayBuffer(modelFilePath)

      // 创建 CubismUserModel
      this.userModel = new CubismUserModel()

      // 加载 moc3 模型
      this.userModel.loadModel(mocBuffer, false)

      // 创建动作管理器
      this.motionManager = new CubismMotionManager()
      this.expressionManager = new CubismExpressionMotionManager()

      // 步骤3：加载表情
      this.state = LoadStep.LoadExpression
      await this.loadExpressions()

      // 步骤4：加载物理
      this.state = LoadStep.LoadPhysics
      await this.loadPhysics()

      // 步骤5：加载姿势
      this.state = LoadStep.LoadPose
      await this.loadPose()

      // 步骤6：加载动作
      this.state = LoadStep.LoadMotion
      await this.loadMotions()

      // 步骤7：设置眼睛眨动
      this.eyeBlink = CubismEyeBlink.create(this.modelSetting)

      // 步骤8：设置呼吸效果
      this.breath = CubismBreath.create()
      this.breath.setParameters([
        {
          parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleX),
          offset: 0.0,
          peak: 15.0,
          cycle: 6.5345,
          weight: 0.5
        },
        {
          parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleY),
          offset: 0.0,
          peak: 8.0,
          cycle: 3.5345,
          weight: 0.5
        },
        {
          parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleZ),
          offset: 0.0,
          peak: 10.0,
          cycle: 5.5345,
          weight: 0.5
        },
        {
          parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBodyAngleX),
          offset: 0.0,
          peak: 4.0,
          cycle: 15.5345,
          weight: 0.5
        },
        {
          parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBreath),
          offset: 0.5,
          peak: 0.5,
          cycle: 3.2345,
          weight: 0.5
        }
      ])

      this.state = LoadStep.CompleteSetup
      this.isInitialized = true

      console.log('[CubismModel] 模型加载完成:', modelPath)

    } catch (error) {
      console.error('[CubismModel] 模型加载失败:', error)
      throw error
    }
  }

  /**
   * 从文件加载 ArrayBuffer
   */
  private async loadFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`无法加载文件: ${filePath} (${response.status})`)
    }
    return await response.arrayBuffer()
  }

  /**
   * 加载表情
   */
  private async loadExpressions(): Promise<void> {
    if (!this.modelSetting) return

    const expressionCount = this.modelSetting.getExpressionCount()
    if (expressionCount === 0) {
      console.log('[CubismModel] 无表情文件')
      return
    }

    console.log(`[CubismModel] 加载 ${expressionCount} 个表情`)

    for (let i = 0; i < expressionCount; i++) {
      const expressionFileName = this.modelSetting.getExpressionFileName(i)
      if (!expressionFileName) continue

      const expressionPath = getExpressionPath(this.modelPath, expressionFileName)
      const name = expressionFileName.replace(/\.(exp3\.json|json)$/, '')

      try {
        const expressionBuffer = await this.loadFileAsArrayBuffer(expressionPath)
        const expression = CubismExpressionMotion.create(expressionBuffer, expressionBuffer.byteLength)
        this.expressionFiles.push({
          name,
          file: expressionFileName,
          expression
        })
        console.log(`[CubismModel] 表情加载成功: ${name}`)
      } catch (error) {
        console.warn(`[CubismModel] 表情加载失败: ${expressionPath}`, error)
        this.expressionFiles.push({ name, file: expressionFileName })
      }
    }
  }

  /**
   * 加载物理
   */
  private async loadPhysics(): Promise<void> {
    if (!this.modelSetting) return

    const physicsFileName = this.modelSetting.getPhysicsFileName()
    if (!physicsFileName) {
      console.log('[CubismModel] 无物理文件')
      return
    }

    const physicsPath = getPhysicsPath(this.modelPath, physicsFileName)
    console.log('[CubismModel] 加载物理:', physicsPath)

    try {
      const physicsBuffer = await this.loadFileAsArrayBuffer(physicsPath)
      this.physics = CubismPhysics.create(physicsBuffer, physicsBuffer.byteLength)
      console.log('[CubismModel] 物理加载成功')
    } catch (error) {
      console.warn('[CubismModel] 物理加载失败:', error)
    }
  }

  /**
   * 加载姿势
   */
  private async loadPose(): Promise<void> {
    if (!this.modelSetting) return

    const poseFileName = this.modelSetting.getPoseFileName()
    if (!poseFileName) {
      console.log('[CubismModel] 无姿势文件')
      return
    }

    const posePath = getPosePath(this.modelPath, poseFileName)
    console.log('[CubismModel] 加载姿势:', posePath)

    try {
      const poseBuffer = await this.loadFileAsArrayBuffer(posePath)
      this.pose = CubismPose.create(poseBuffer, poseBuffer.byteLength)
      console.log('[CubismModel] 姿势加载成功')
    } catch (error) {
      console.warn('[CubismModel] 姿势加载失败:', error)
    }
  }

  /**
   * 加载动作
   */
  private async loadMotions(): Promise<void> {
    if (!this.modelSetting) return

    const motionGroupCount = this.modelSetting.getMotionGroupCount()
    if (motionGroupCount === 0) {
      console.log('[CubismModel] 无动作文件')
      return
    }

    console.log(`[CubismModel] 加载 ${motionGroupCount} 个动作组`)

    for (let i = 0; i < motionGroupCount; i++) {
      const groupName = this.modelSetting.getMotionGroupName(i)
      const motionCount = this.modelSetting.getMotionCount(groupName)

      const motions: Array<{ file: string; motion?: CubismMotion }> = []

      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this.modelSetting.getMotionFileName(groupName, j)
        if (!motionFileName) continue

        const motionPath = getMotionPath(this.modelPath, motionFileName)

        try {
          const motionBuffer = await this.loadFileAsArrayBuffer(motionPath)
          const motion = CubismMotion.create(motionBuffer, motionBuffer.byteLength)
          motions.push({
            file: motionFileName,
            motion
          })
        } catch (error) {
          console.warn(`[CubismModel] 动作加载失败: ${motionPath}`, error)
          motions.push({ file: motionFileName })
        }
      }

      this.motionGroups.set(groupName, motions)
    }

    console.log('[CubismModel] 动作加载完成')
  }

  /**
   * 加载纹理
   */
  async loadTextures(): Promise<void> {
    if (!this.modelSetting || !this.gl) return

    const textureCount = this.modelSetting.getTextureCount()
    if (textureCount === 0) {
      console.log('[CubismModel] 无纹理')
      return
    }

    console.log(`[CubismModel] 加载 ${textureCount} 个纹理`)

    for (let i = 0; i < textureCount; i++) {
      const textureFileName = this.modelSetting.getTextureFileName(i)
      if (!textureFileName) continue

      const texturePath = getTexturePath(this.modelPath, textureFileName)

      try {
        const texture = await this.loadTexture(texturePath)
        this.textures[i] = texture

        // 绑定纹理到渲染器
        if (this.renderer) {
          this.renderer.bindTexture(i, texture)
        }

        console.log(`[CubismModel] 纹理 ${i} 加载完成: ${texturePath}`)
      } catch (error) {
        console.warn(`[CubismModel] 纹理加载失败: ${texturePath}`, error)
      }
    }
  }

  /**
   * 加载纹理图像
   */
  private async loadTexture(texturePath: string): Promise<WebGLTexture> {
    if (!this.gl) {
      throw new Error('WebGL 上下文未初始化')
    }

    return new Promise<WebGLTexture>((resolve, reject) => {
      const image = new Image()

      image.onload = () => {
        try {
          const texture = this.gl!.createTexture()
          if (!texture) {
            reject(new Error('创建纹理失败'))
            return
          }

          this.gl!.bindTexture(this.gl!.TEXTURE_2D, texture)
          this.gl!.texImage2D(
            this.gl!.TEXTURE_2D,
            0,
            this.gl!.RGBA,
            this.gl!.RGBA,
            this.gl!.UNSIGNED_BYTE,
            image
          )

          // 设置纹理参数
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_WRAP_S, this.gl!.CLAMP_TO_EDGE)
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_WRAP_T, this.gl!.CLAMP_TO_EDGE)
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MIN_FILTER, this.gl!.LINEAR)
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MAG_FILTER, this.gl!.LINEAR)

          resolve(texture)
        } catch (error) {
          reject(error)
        }
      }

      image.onerror = () => {
        reject(new Error(`无法加载纹理: ${texturePath}`))
      }

      image.crossOrigin = 'anonymous'
      image.src = texturePath
    })
  }

  // ============================================================================
  // WebGL 初始化方法
  // ============================================================================

  /**
   * 初始化 WebGL
   */
  initWebGL(canvas: HTMLCanvasElement, initialPosition?: Position): void {
    console.log('[CubismModel] 初始化 WebGL')

    this.canvas = canvas

    // 获取 WebGL 上下文
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      throw new Error('无法获取 WebGL 上下文')
    }
    this.gl = gl as WebGLRenderingContext

    // 设置画布尺寸
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // 创建渲染器
    if (this.userModel) {
      this.userModel.createRenderer(canvas.width, canvas.height)
      this.renderer = this.userModel.getRenderer() as CubismRenderer_WebGL

      if (this.renderer) {
        this.renderer.startUp(this.gl)
      }
    }

    // 设置模型初始位置和大小
    this.setupModelTransform(initialPosition)

    this.isInitialized = true
    console.log('[CubismModel] WebGL 初始化完成')
  }

  /**
   * 设置模型变换
   */
  private setupModelTransform(initialPosition?: Position): void {
    if (!this.canvas || !this.userModel) return

    const width = this.canvas.width
    const height = this.canvas.height

    // 获取模型矩阵
    this.modelMatrix = this.userModel.getModelMatrix()

    // 计算模型缩放
    const model = this.userModel.getModel()
    const modelWidth = model ? model.getCanvasWidth() : 1
    const modelHeight = model ? model.getCanvasHeight() : 1

    const scale = Math.min(
      width / modelWidth,
      height / modelHeight
    ) * 0.3 // 缩放系数：0.3 = 占屏幕 30%

    // 设置模型矩阵
    if (this.modelMatrix) {
      this.modelMatrix.loadIdentity()
      this.modelMatrix.scale(scale, scale)

      // 设置模型位置
      if (initialPosition) {
        const centerX = (initialPosition.x - width / 2) / scale
        const centerY = (height - initialPosition.y - height / 2) / scale
        this.modelMatrix.translate(centerX, centerY)
        console.log('[CubismModel] 使用保存的位置:', initialPosition)
      } else {
        console.log('[CubismModel] 使用默认中心位置')
      }
    }

    // 设置投影矩阵
    this.projectionMatrix.loadIdentity()
    this.projectionMatrix.scale(width / 2, height / 2)

    console.log(`[CubismModel] 模型变换设置完成: 缩放=${scale.toFixed(2)}, 画布=${width}x${height}`)
  }

  // ============================================================================
  // 更新和渲染方法
  // ============================================================================

  /**
   * 更新模型
   */
  update(): void {
    if (!this.isInitialized || this.isUpdating || !this.userModel) return

    this.isUpdating = true

    const now = performance.now() / 1000
    this.deltaTime = now - this.lastUpdateTime
    this.lastUpdateTime = now
    this.userTimeSeconds += this.deltaTime

    const deltaTimeSeconds = this.deltaTime

    // 更新拖拽管理器
    this.dragManager.update(deltaTimeSeconds)

    // 保存参数
    this.userModel.getModel().saveParameters()

    // 更新动作
    if (this.motionManager) {
      if (this.motionManager.isFinished()) {
        // 播放随机待机动作
        this.startRandomMotion('Idle', MotionPriority.Idle)
      } else {
        this.motionManager.updateMotion(this.userModel.getModel(), deltaTimeSeconds)
      }
    }

    // 更新表情
    if (this.expressionManager) {
      this.expressionManager.updateMotion(this.userModel.getModel(), deltaTimeSeconds)
    }

    // 更新眼睛眨动
    if (this.eyeBlink) {
      this.eyeBlink.updateParameters(this.userModel.getModel(), deltaTimeSeconds)
    }

    // 更新呼吸效果
    if (this.breath) {
      this.breath.updateParameters(this.userModel.getModel(), deltaTimeSeconds)
    }

    // 更新物理
    if (this.physics) {
      this.physics.evaluate(this.userModel.getModel(), deltaTimeSeconds)
    }

    // 更新姿势
    if (this.pose) {
      this.pose.updateParameters(this.userModel.getModel(), deltaTimeSeconds)
    }

    // 更新眼睛注视
    const dragX = this.dragManager.getX()
    const dragY = this.dragManager.getY()

    // 设置角度参数
    const model = this.userModel.getModel()
    model.addParameterValueById('ParamAngleX', dragX * 30)
    model.addParameterValueById('ParamAngleY', dragY * 30)
    model.addParameterValueById('ParamAngleZ', dragX * dragY * -30)
    model.addParameterValueById('ParamBodyAngleX', dragX * 10)
    model.addParameterValueById('ParamEyeBallX', dragX)
    model.addParameterValueById('ParamEyeBallY', dragY)

    // 更新口型同步
    if (this.lipSyncValue > 0) {
      model.addParameterValueById(this.lipSyncParamId, this.lipSyncValue, 0.8)
    }

    // 更新模型
    this.userModel.getModel().update()

    // 更新 FPS
    this.updateFps()

    this.isUpdating = false
  }

  /**
   * 更新 FPS
   */
  private updateFps(): void {
    this.frameCount++
    const now = performance.now()

    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.lastFpsUpdate = now
    }
  }

  /**
   * 渲染模型
   */
  render(): void {
    if (!this.isInitialized || !this.gl || !this.renderer) return

    // 清除画布
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // 设置视口
    if (this.canvas) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    // 设置投影矩阵
    this.renderer.setMvpMatrix(this.projectionMatrix)

    // 渲染模型
    this.renderer.drawModel()
  }

  // ============================================================================
  // 交互方法
  // ============================================================================

  /**
   * 让模型注视指定屏幕坐标
   */
  focus(x: number, y: number): void {
    if (!this.canvas) return

    // 转换为标准化坐标 (-1 到 1)
    const normalizedX = (x / this.canvas.width) * 2 - 1
    const normalizedY = (y / this.canvas.height) * 2 - 1

    this.dragManager.set(normalizedX, normalizedY)
  }

  /**
   * 播放动作
   */
  motion(group: string, index: number = 0, priority: number = MotionPriority.Normal): void {
    console.log(`[CubismModel] 播放动作: ${group}[${index}] (优先级: ${priority})`)

    if (!this.motionManager) {
      console.warn('[CubismModel] 动作管理器未初始化')
      return
    }

    const motions = this.motionGroups.get(group)
    if (!motions || index >= motions.length) {
      console.warn(`[CubismModel] 动作未找到: ${group}[${index}]`)
      return
    }

    const motionData = motions[index]
    if (!motionData.motion) {
      console.warn(`[CubismModel] 动作数据未加载: ${group}[${index}]`)
      return
    }

    // 开始播放动作
    this.motionManager.startMotion(motionData.motion, false, priority)
  }

  /**
   * 播放随机动作
   */
  startRandomMotion(groupName: string, priority: number = MotionPriority.Normal): void {
    const motions = this.motionGroups.get(groupName)
    if (!motions || motions.length === 0) {
      console.warn(`[CubismModel] 动作组为空: ${groupName}`)
      return
    }

    // 随机选择一个动作
    const motionIndex = Math.floor(Math.random() * motions.length)
    this.motion(groupName, motionIndex, priority)
  }

  /**
   * 设置表情
   */
  expression(expressionId: string | number): void {
    console.log(`[CubismModel] 设置表情: ${expressionId}`)

    if (!this.expressionManager) {
      console.warn('[CubismModel] 表情管理器未初始化')
      return
    }

    const expressionName = typeof expressionId === 'number'
      ? this.expressionFiles[expressionId]?.name
      : expressionId

    if (!expressionName) {
      console.warn(`[CubismModel] 表情未找到: ${expressionId}`)
      return
    }

    const expressionData = this.expressionFiles.find(e => e.name === expressionName)
    if (!expressionData || !expressionData.expression) {
      console.warn(`[CubismModel] 表情未找到: ${expressionName}`)
      return
    }

    this.expressionManager.startMotion(expressionData.expression, false)
  }

  // ============================================================================
  // 口型同步方法
  // ============================================================================

  /**
   * 开始口型同步
   */
  startLipSync(audioElement: HTMLAudioElement): void {
    console.log('[CubismModel] 开始口型同步')

    this.stopLipSync()

    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextCtor) {
        console.warn('[CubismModel] 当前环境不支持 AudioContext')
        return
      }

      if (!this.lipSyncContext || this.lipSyncAudioElement !== audioElement) {
        this.destroyLipSyncPipeline()
        this.lipSyncContext = new AudioContextCtor()
        this.lipSyncAnalyser = this.lipSyncContext.createAnalyser()
        this.lipSyncAnalyser.fftSize = 256
        this.lipSyncSource = this.lipSyncContext.createMediaElementSource(audioElement)
        this.lipSyncSource.connect(this.lipSyncAnalyser)
        this.lipSyncAnalyser.connect(this.lipSyncContext.destination)
        this.lipSyncAudioElement = audioElement
      }

      if (this.lipSyncContext.state === 'suspended') {
        void this.lipSyncContext.resume().catch(() => {})
      }

      const analyser = this.lipSyncAnalyser
      if (!analyser) {
        console.warn('[CubismModel] 口型同步分析器未初始化')
        return
      }
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      // 口型同步动画循环
      const updateLipSync = () => {
        if (audioElement.paused || audioElement.ended) {
          this.lipSyncValue = 0
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
        this.lipSyncValue = Math.min(average / 128, 1.0)

        // 继续下一帧
        this.lipSyncFrameId = requestAnimationFrame(updateLipSync)
      }

      updateLipSync()

      this.lipSyncEndedHandler = () => {
        this.stopLipSync()
      }
      audioElement.addEventListener('ended', this.lipSyncEndedHandler)

    } catch (error) {
      console.error('[CubismModel] 口型同步初始化失败:', error)
    }
  }

  /**
   * 停止口型同步
   */
  stopLipSync(): void {
    if (this.lipSyncFrameId !== null) {
      cancelAnimationFrame(this.lipSyncFrameId)
      this.lipSyncFrameId = null
    }

    if (this.lipSyncAudioElement && this.lipSyncEndedHandler) {
      this.lipSyncAudioElement.removeEventListener('ended', this.lipSyncEndedHandler)
    }

    this.lipSyncEndedHandler = null
    this.lipSyncValue = 0
  }

  /**
   * 销毁口型同步管线
   */
  private destroyLipSyncPipeline(): void {
    this.stopLipSync()

    if (this.lipSyncSource) {
      try {
        this.lipSyncSource.disconnect()
      } catch {}
      this.lipSyncSource = null
    }

    if (this.lipSyncAnalyser) {
      try {
        this.lipSyncAnalyser.disconnect()
      } catch {}
      this.lipSyncAnalyser = null
    }

    if (this.lipSyncContext) {
      void this.lipSyncContext.close().catch(() => {})
      this.lipSyncContext = null
    }

    this.lipSyncAudioElement = null
  }

  // ============================================================================
  // 信息获取方法
  // ============================================================================

  /**
   * 获取模型信息
   */
  getModelInfo(): CubismModelInfo {
    // 获取动作组信息
    const motionGroups: Record<string, Array<{ index: number; file: string }>> = {}
    this.motionGroups.forEach((motions, groupName) => {
      motionGroups[groupName] = motions.map((motion, index) => ({
        index,
        file: motion.file
      }))
    })

    // 获取表情信息
    const expressions = this.expressionFiles.map(e => e.name)

    return {
      name: this.getModelName(),
      motionGroups,
      expressions
    }
  }

  /**
   * 获取模型边界
   */
  getModelBounds(): ModelBounds | null {
    if (!this.canvas || !this.userModel) return null

    const model = this.userModel.getModel()
    const modelWidth = model ? model.getCanvasWidth() : 200
    const modelHeight = model ? model.getCanvasHeight() : 200

    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    return {
      left: centerX - modelWidth / 2,
      right: centerX + modelWidth / 2,
      top: centerY - modelHeight / 2,
      bottom: centerY + modelHeight / 2,
      width: modelWidth,
      height: modelHeight
    }
  }

  /**
   * 获取纹理源列表（用于颜色提取）
   */
  getTextureSources(): HTMLImageElement[] {
    if (!this.renderer || !this.gl) return []

    try {
      const textures = (this.renderer as any).getBindedTextures?.()
      if (!textures || textures.size === 0) return []

      const sources: HTMLImageElement[] = []

      // 遍历所有纹理
      textures.forEach((glTexture: WebGLTexture, index: number) => {
        if (!glTexture) return

        try {
          // 创建临时 canvas 来读取纹理数据
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')
          if (!tempCtx) return

          // 使用固定尺寸（因为 WebGL 不提供直接获取纹理尺寸的方法）
          const width = 256
          const height = 256

          tempCanvas.width = width
          tempCanvas.height = height

          // 使用 readPixels 读取纹理数据
          const framebuffer = this.gl!.createFramebuffer()
          this.gl!.bindFramebuffer(this.gl!.FRAMEBUFFER, framebuffer)
          this.gl!.framebufferTexture2D(this.gl!.FRAMEBUFFER, this.gl!.COLOR_ATTACHMENT0, this.gl!.TEXTURE_2D, glTexture, 0)

          // 检查 framebuffer 状态
          const status = this.gl!.checkFramebufferStatus(this.gl!.FRAMEBUFFER)
          if (status !== this.gl!.FRAMEBUFFER_COMPLETE) {
            console.warn(`[CubismModel] Framebuffer 不完整: ${status}`)
            this.gl!.bindFramebuffer(this.gl!.FRAMEBUFFER, null)
            this.gl!.deleteFramebuffer(framebuffer)
            return
          }

          const pixels = new Uint8Array(width * height * 4)
          this.gl!.readPixels(0, 0, width, height, this.gl!.RGBA, this.gl!.UNSIGNED_BYTE, pixels)

          // 清理 framebuffer
          this.gl!.bindFramebuffer(this.gl!.FRAMEBUFFER, null)
          this.gl!.deleteFramebuffer(framebuffer)

          // 将像素数据绘制到 canvas
          const imageData = tempCtx.createImageData(width, height)

          // WebGL 的 readPixels 返回的是从底部到顶部的数据，需要翻转
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const srcIndex = ((height - y - 1) * width + x) * 4
              const dstIndex = (y * width + x) * 4
              imageData.data[dstIndex] = pixels[srcIndex]     // R
              imageData.data[dstIndex + 1] = pixels[srcIndex + 1] // G
              imageData.data[dstIndex + 2] = pixels[srcIndex + 2] // B
              imageData.data[dstIndex + 3] = pixels[srcIndex + 3] // A
            }
          }

          tempCtx.putImageData(imageData, 0, 0)

          // 创建 HTMLImageElement
          const img = new Image()
          img.src = tempCanvas.toDataURL()
          sources.push(img)
        } catch (e) {
          console.warn(`[CubismModel] 读取纹理 ${index} 失败:`, e)
        }
      })

      return sources
    } catch (e) {
      console.warn('[CubismModel] 获取纹理源失败:', e)
      return []
    }
  }

  /**
   * 获取纹理源（用于颜色提取）
   */
  getTextureSource(): HTMLImageElement | null {
    return this.getTextureSources()[0] || null
  }

  /**
   * 检查点是否在模型内
   */
  isPointInModel(x: number, y: number): boolean {
    const bounds = this.getModelBounds()
    if (!bounds) return false

    return x >= bounds.left && x <= bounds.right &&
           y >= bounds.top && y <= bounds.bottom
  }

  // ============================================================================
  // 位置管理方法
  // ============================================================================

  /**
   * 设置模型位置
   */
  setModelPosition(x: number, y: number): void {
    this.modelX = x
    this.modelY = y
    
    // 重新设置模型变换
    if (this.isInitialized) {
      this.setupModelTransform({ x, y })
    }
    
    console.log('[CubismModel] 模型位置已设置:', { x, y })
  }

  /**
   * 获取模型位置
   */
  getModelPosition(): { x: number; y: number } | null {
    if (!this.isInitialized) return null
    
    return {
      x: this.modelX,
      y: this.modelY
    }
  }

  // ============================================================================
  // 窗口管理方法
  // ============================================================================

  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    if (!this.canvas) return

    this.canvas.width = width
    this.canvas.height = height

    if (this.gl) {
      this.gl.viewport(0, 0, width, height)
    }

    // 重新设置模型变换
    this.setupModelTransform()

    console.log(`[CubismModel] 画布大小调整为: ${width}x${height}`)
  }

  // ============================================================================
  // 清理方法
  // ============================================================================

  /**
   * 销毁模型
   */
  destroy(): void {
    console.log('[CubismModel] 销毁模型')

    this.stopLipSync()
    this.destroyLipSyncPipeline()

    // 清理 WebGL 资源
    if (this.gl) {
      this.textures.forEach(texture => {
        if (texture) {
          this.gl!.deleteTexture(texture)
        }
      })
      this.textures = []
    }

    // 释放渲染器
    if (this.renderer) {
      this.renderer = null
    }

    // 释放用户模型
    if (this.userModel) {
      this.userModel = null
    }

    // 重置状态
    this.isInitialized = false
    this.modelSetting = null
    this.motionManager = null
    this.expressionManager = null
    this.eyeBlink = null
    this.breath = null
    this.physics = null
    this.pose = null
    this.motionGroups.clear()
    this.expressionFiles = []

    console.log('[CubismModel] 模型销毁完成')
  }

  /**
   * 销毁全局资源
   */
  static destroyGlobal(): void {
    console.log('[CubismModel] 销毁全局资源')

    if (CubismModel.frameworkInitialized) {
      CubismFramework.dispose()
      CubismModel.frameworkInitialized = false
    }

    if (CubismModel.frameworkStarted) {
      CubismFramework.cleanUp()
      CubismModel.frameworkStarted = false
    }
  }
}

// ============================================================================
// 导出类型
// ============================================================================

export type { CubismModelInfo, ModelBounds, Position }
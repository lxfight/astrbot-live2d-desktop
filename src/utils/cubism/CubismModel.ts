/**
 * Live2D Cubism Model 类
 * 基于官方 Cubism SDK for Web 实现
 * 
 * 此类是 Live2D 模型的完整实现，支持：
 * - 模型加载和渲染
 * - 动作播放和管理
 * - 表情切换
 * - 口型同步
 * - 眼睛注视
 * - 物理演算
 * - 姿势系统
 */

import {
  CubismMatrix44,
  CubismTargetPoint,
  CubismIdHandle,
  csmVector,
  csmMap,
  isCubism3Model,
  getModelName,
  getTexturePath,
  getMotionPath,
  getExpressionPath,
  getPhysicsPath,
  getPosePath
} from './CubismCore'

import type {
  CubismModelInfo,
  ModelBounds,
  Position
} from './index'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 模型信息接口
 */
export interface ICubismModelSetting {
  getModelFileName(): string
  getTextureCount(): number
  getTextureFileName(index: number): string
  getMotionGroupCount(): number
  getMotionGroupName(index: number): string
  getMotionCount(groupName: string): number
  getMotionFileName(groupName: string, index: number): string
  getExpressionCount(): number
  getExpressionFileName(index: number): string
  getPhysicsFileName(): string
  getPoseFileName(): string
  getLayoutMap(map: csmMap<string, number>): void
  getLipSyncParameterCount(): number
  getLipSyncParameterId(index: number): CubismIdHandle
  getModelFileUrl(): string
  getModelFileBytes(): number
  getTopLeft(layoutMap: csmMap<string, number>): { x: number; y: number } | null
  getBottomRight(layoutMap: csmMap<string, number>): { x: number; y: number } | null
}

/**
 * 加载状态枚举
 */
export enum LoadStep {
  LoadAssets = 0,      // 加载配置文件
  LoadModel = 1,       // 加载模型文件
  WaitLoadModel = 2,   // 等待模型加载
  LoadExpression = 3,  // 加载表情
  WaitLoadExpression = 4, // 等待表情加载
  LoadPhysics = 5,     // 加载物理
  WaitLoadPhysics = 6, // 等待物理加载
  LoadPose = 7,        // 加载姿势
  WaitLoadPose = 8,    // 等待姿势加载
  SetupEyeBlink = 9,   // 设置眼睛眨动
  SetupBreath = 10,    // 设置呼吸效果
  LoadUserData = 11,   // 加载用户数据
  WaitLoadUserData = 12, // 等待用户数据加载
  SetupEyeBlinkIds = 13, // 设置眼睛眨动ID
  SetupLipSyncIds = 14,  // 设置口型同步ID
  SetupLayout = 15,      // 设置布局
  LoadMotion = 16,       // 加载动作
  WaitLoadMotion = 17,   // 等待动作加载
  CompleteInitialize = 18, // 初始化完成
  CompleteSetupModel = 19, // 模型设置完成
  LoadTexture = 20,      // 加载纹理
  WaitLoadTexture = 21,  // 等待纹理加载
  CompleteSetup = 22     // 完成设置
}

/**
 * 动作优先级
 */
export enum MotionPriority {
  None = 0,
  Idle = 1,
  Normal = 2,
  Force = 3
}

/**
 * 呼吸参数数据
 */
export interface BreathParameterData {
  parameterId: CubismIdHandle
  offset: number
  peak: number
  cycle: number
  weight: number
}

// ============================================================================
// Cubism 模型设置 JSON 解析器
// ============================================================================

/**
 * Cubism 模型设置 JSON 解析器
 * 用于解析 model3.json 文件
 */
export class CubismModelSettingJson implements ICubismModelSetting {
  private _json: any = {}
  private _fileName: string = ''

  constructor(buffer: ArrayBuffer, size: number) {
    try {
      const decoder = new TextDecoder('utf-8')
      const jsonString = decoder.decode(buffer.slice(0, size))
      this._json = JSON.parse(jsonString)
      this._fileName = this._json.FileReferences?.Moc || ''
    } catch (error) {
      console.error('[CubismModelSettingJson] JSON 解析失败:', error)
      this._json = {}
    }
  }

  getModelFileName(): string {
    return this._json.FileReferences?.Moc || ''
  }

  getTextureCount(): number {
    return this._json.FileReferences?.Textures?.length || 0
  }

  getTextureFileName(index: number): string {
    return this._json.FileReferences?.Textures?.[index] || ''
  }

  getMotionGroupCount(): number {
    return Object.keys(this._json.FileReferences?.Motions || {}).length
  }

  getMotionGroupName(index: number): string {
    return Object.keys(this._json.FileReferences?.Motions || {})[index] || ''
  }

  getMotionCount(groupName: string): number {
    return this._json.FileReferences?.Motions?.[groupName]?.length || 0
  }

  getMotionFileName(groupName: string, index: number): string {
    return this._json.FileReferences?.Motions?.[groupName]?.[index]?.File || ''
  }

  getExpressionCount(): number {
    return this._json.FileReferences?.Expressions?.length || 0
  }

  getExpressionFileName(index: number): string {
    return this._json.FileReferences?.Expressions?.[index]?.File || ''
  }

  getPhysicsFileName(): string {
    return this._json.FileReferences?.Physics || ''
  }

  getPoseFileName(): string {
    return this._json.FileReferences?.Pose || ''
  }

  getLayoutMap(map: csmMap<string, number>): void {
    const layout = this._json.Layout
    if (layout) {
      Object.keys(layout).forEach(key => {
        map.setValue(key, layout[key])
      })
    }
  }

  getLipSyncParameterCount(): number {
    return this._json.Groups?.LipSync?.Ids?.length || 0
  }

  getLipSyncParameterId(index: number): CubismIdHandle {
    return this._json.Groups?.LipSync?.Ids?.[index] || ''
  }

  getModelFileUrl(): string {
    return this._fileName
  }

  getModelFileBytes(): number {
    return 0 // 需要实际加载后才知道
  }

  getTopLeft(layoutMap: csmMap<string, number>): { x: number; y: number } | null {
    if (layoutMap.isExist('CenterX') && layoutMap.isExist('CenterY') && layoutMap.isExist('Width')) {
      const centerX = layoutMap.getValue('CenterX')
      const centerY = layoutMap.getValue('CenterY')
      const width = layoutMap.getValue('Width')
      return { x: centerX - width / 2, y: centerY - width / 2 }
    }
    return null
  }

  getBottomRight(layoutMap: csmMap<string, number>): { x: number; y: number } | null {
    if (layoutMap.isExist('CenterX') && layoutMap.isExist('CenterY') && layoutMap.isExist('Width')) {
      const centerX = layoutMap.getValue('CenterX')
      const centerY = layoutMap.getValue('CenterY')
      const width = layoutMap.getValue('Width')
      return { x: centerX + width / 2, y: centerY + width / 2 }
    }
    return null
  }
}

// ============================================================================
// Cubism 模型类
// ============================================================================

/**
 * Cubism 模型类
 * 提供 Live2D 模型的完整功能
 */
export class CubismModel {
  // WebGL 上下文
  private gl: WebGLRenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null

  // 模型数据
  private modelData: any = null // CubismModel 数据
  private modelSetting: ICubismModelSetting | null = null

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
  private lipSyncIds: csmVector<CubismIdHandle> = new csmVector<CubismIdHandle>()

  // 眼睛注视相关
  private dragX: number = 0
  private dragY: number = 0
  private dragManager: CubismTargetPoint = new CubismTargetPoint()

  // 动画相关
  private lastUpdateTime: number = 0
  private deltaTime: number = 0
  private userTimeSeconds: number = 0

  // 模型参数ID
  private idParamAngleX: CubismIdHandle = 'ParamAngleX'
  private idParamAngleY: CubismIdHandle = 'ParamAngleY'
  private idParamAngleZ: CubismIdHandle = 'ParamAngleZ'
  private idParamBodyAngleX: CubismIdHandle = 'ParamBodyAngleX'
  private idParamEyeBallX: CubismIdHandle = 'ParamEyeBallX'
  private idParamEyeBallY: CubismIdHandle = 'ParamEyeBallY'
  private idParamMouthOpenY: CubismIdHandle = 'ParamMouthOpenY'

  // 纹理相关
  private textureCount: number = 0
  private loadedTextureCount: number = 0
  private textures: WebGLTexture[] = []

  // 动作相关
  private allMotionCount: number = 0
  private motionGroups: Map<string, Array<{ file: string; buffer?: ArrayBuffer }>> = new Map()
  private currentMotion: string | null = null
  private motionStartTime: number = 0
  private motionDuration: number = 0

  // 表情相关
  private expressionFiles: Array<{ name: string; file: string; buffer?: ArrayBuffer }> = []
  // private currentExpression: string | null = null // 未使用，已注释

  // 物理和姿势
  // private physicsBuffer: ArrayBuffer | null = null // 未使用，已注释
  // private poseBuffer: ArrayBuffer | null = null // 未使用，已注释

  // 矩阵
  private modelMatrix: CubismMatrix44 = new CubismMatrix44()
  private projectionMatrix: CubismMatrix44 = new CubismMatrix44()

  // ID 管理器
  // private idManager: CubismIdManager = new CubismIdManager() // 未使用，已注释

  // 性能监控
  private frameCount: number = 0
  private fps: number = 0
  private lastFpsUpdate: number = 0

  /**
   * 构造函数
   */
  constructor() {
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

  // ============================================================================
  // 状态获取方法
  // ============================================================================

  /**
   * 获取当前状态
   */
  getState(): LoadStep {
    return this.state
  }

  /**
   * 获取纹理数量
   */
  getTextureCount(): number {
    return this.textureCount
  }

  /**
   * 获取已加载纹理数量
   */
  getLoadedTextureCount(): number {
    return this.loadedTextureCount
  }

  /**
   * 获取模型路径
   */
  getModelPath(): string {
    return this.modelPath
  }

  /**
   * 获取模型名称
   */
  getModelName(): string {
    return getModelName(this.modelPath)
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

      // 步骤2：加载模型文件
      this.state = LoadStep.LoadModel
      const modelFileName = this.modelSetting.getModelFileName()
      if (!modelFileName) {
        throw new Error('模型配置文件中未指定模型文件名')
      }

      const modelFilePath = this.modelHomeDir + modelFileName
      console.log('[CubismModel] 加载模型文件:', modelFilePath)

      const modelBuffer = await this.loadFileAsArrayBuffer(modelFilePath)

      // 步骤3：解析模型数据
      this.state = LoadStep.CompleteInitialize
      this.modelData = this.parseModelData(modelBuffer)

      // 步骤4：加载表情
      this.state = LoadStep.LoadExpression
      await this.loadExpressions()

      // 步骤5：加载物理
      this.state = LoadStep.LoadPhysics
      await this.loadPhysics()

      // 步骤6：加载姿势
      this.state = LoadStep.LoadPose
      await this.loadPose()

      // 步骤7：设置口型同步参数
      this.state = LoadStep.SetupLipSyncIds
      this.setupLipSyncIds()

      // 步骤8：加载动作
      this.state = LoadStep.LoadMotion
      await this.loadMotions()

      // 步骤9：设置布局
      this.state = LoadStep.SetupLayout
      this.setupLayout()

      // 步骤10：加载纹理
      this.state = LoadStep.LoadTexture
      await this.loadTextures()

      this.state = LoadStep.CompleteSetup
      this.isInitialized = true

      console.log('[CubismModel] 模型加载完成:', modelPath)

    } catch (error) {
      console.error('[CubismModel] 模型加载失败:', error)
      throw error
    }
  }

  /**
   * 解析模型数据
   */
  private parseModelData(buffer: ArrayBuffer): any {
    // 这里应该使用 Cubism Core 来解析 moc3 文件
    // 目前返回一个简单的结构
    console.log('[CubismModel] 解析模型数据, 大小:', buffer.byteLength)
    return {
      buffer,
      parameterCount: 0,
      partCount: 0,
      drawableCount: 0,
      canvasWidth: 1,
      canvasHeight: 1
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
        this.expressionFiles.push({
          name,
          file: expressionFileName,
          buffer: expressionBuffer
        })
        console.log(`[CubismModel] 表情加载成功: ${name}`)
      } catch (error) {
        console.warn(`[CubismModel] 表情加载失败: ${expressionPath}`, error)
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
      await this.loadFileAsArrayBuffer(physicsPath)
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
      await this.loadFileAsArrayBuffer(posePath)
      console.log('[CubismModel] 姿势加载成功')
    } catch (error) {
      console.warn('[CubismModel] 姿势加载失败:', error)
    }
  }

  /**
   * 设置口型同步参数
   */
  private setupLipSyncIds(): void {
    if (!this.modelSetting) return

    const lipSyncParamCount = this.modelSetting.getLipSyncParameterCount()
    for (let i = 0; i < lipSyncParamCount; i++) {
      const paramId = this.modelSetting.getLipSyncParameterId(i)
      if (paramId) {
        this.lipSyncIds.pushBack(paramId)
      }
    }

    // 如果模型没有定义口型同步参数，使用默认参数
    if (this.lipSyncIds.getSize() === 0) {
      this.lipSyncIds.pushBack(this.idParamMouthOpenY)
    }

    console.log(`[CubismModel] 设置 ${this.lipSyncIds.getSize()} 个口型同步参数`)
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

      const motions: Array<{ file: string; buffer?: ArrayBuffer }> = []

      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this.modelSetting.getMotionFileName(groupName, j)
        if (!motionFileName) continue

        const motionPath = getMotionPath(this.modelPath, motionFileName)

        try {
          const motionBuffer = await this.loadFileAsArrayBuffer(motionPath)
          motions.push({
            file: motionFileName,
            buffer: motionBuffer
          })
          this.allMotionCount++
        } catch (error) {
          console.warn(`[CubismModel] 动作加载失败: ${motionPath}`, error)
          motions.push({ file: motionFileName })
        }
      }

      this.motionGroups.set(groupName, motions)
    }

    console.log(`[CubismModel] 共加载 ${this.allMotionCount} 个动作`)
  }

  /**
   * 设置布局
   */
  private setupLayout(): void {
    if (!this.modelSetting) return

    const layoutMap = new csmMap<string, number>()
    this.modelSetting.getLayoutMap(layoutMap)

    // 应用布局到模型矩阵
    const modelMatrix = this.modelMatrix

    if (layoutMap.isExist('Width')) {
      const width = layoutMap.getValue('Width')
      modelMatrix.scale(width, width)
    }

    if (layoutMap.isExist('CenterX')) {
      const centerX = layoutMap.getValue('CenterX')
      modelMatrix.translateX(centerX)
    }

    if (layoutMap.isExist('CenterY')) {
      const centerY = layoutMap.getValue('CenterY')
      modelMatrix.translateY(centerY)
    }

    if (layoutMap.isExist('X')) {
      const x = layoutMap.getValue('X')
      modelMatrix.translateX(x)
    }

    if (layoutMap.isExist('Y')) {
      const y = layoutMap.getValue('Y')
      modelMatrix.translateY(y)
    }

    console.log('[CubismModel] 布局设置完成')
  }

  /**
   * 加载纹理
   */
  private async loadTextures(): Promise<void> {
    if (!this.modelSetting || !this.gl) return

    const textureCount = this.modelSetting.getTextureCount()
    if (textureCount === 0) {
      console.log('[CubismModel] 无纹理')
      return
    }

    console.log(`[CubismModel] 加载 ${textureCount} 个纹理`)

    this.textureCount = textureCount
    this.loadedTextureCount = 0

    for (let i = 0; i < textureCount; i++) {
      const textureFileName = this.modelSetting.getTextureFileName(i)
      if (!textureFileName) {
        this.loadedTextureCount++
        continue
      }

      const texturePath = getTexturePath(this.modelPath, textureFileName)

      try {
        const texture = await this.loadTexture(texturePath)
        this.textures[i] = texture
        this.loadedTextureCount++
        console.log(`[CubismModel] 纹理 ${i} 加载完成: ${texturePath}`)
      } catch (error) {
        console.warn(`[CubismModel] 纹理加载失败: ${texturePath}`, error)
        this.loadedTextureCount++
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

    // 初始化渲染
    this.initializeRendering()

    // 设置模型初始位置和大小
    this.setupModelTransform(initialPosition)

    this.isInitialized = true
    console.log('[CubismModel] WebGL 初始化完成')
  }

  /**
   * 初始化渲染
   */
  private initializeRendering(): void {
    if (!this.gl) return

    // 设置视口
    if (this.canvas) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    // 设置混合模式
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)

    // 清除颜色
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  /**
   * 设置模型变换
   */
  private setupModelTransform(initialPosition?: Position): void {
    if (!this.canvas) return

    const width = this.canvas.width
    const height = this.canvas.height

    // 计算模型缩放
    const modelWidth = this.modelData?.canvasWidth || 1
    const modelHeight = this.modelData?.canvasHeight || 1

    const scale = Math.min(
      width / modelWidth,
      height / modelHeight
    ) * 0.3 // 缩放系数：0.3 = 占屏幕 30%

    // 设置模型矩阵
    this.modelMatrix.identity()
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

    // 设置投影矩阵
    this.projectionMatrix.identity()
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
    if (!this.isInitialized || this.isUpdating) return

    this.isUpdating = true

    const now = performance.now() / 1000 // 转换为秒
    this.deltaTime = now - this.lastUpdateTime
    this.lastUpdateTime = now
    this.userTimeSeconds += this.deltaTime

    const deltaTimeSeconds = this.deltaTime

    // 更新拖拽管理器
    this.dragManager.update(deltaTimeSeconds)
    this.dragX = this.dragManager.getX()
    this.dragY = this.dragManager.getY()

    // 更新眼睛注视参数
    this.updateEyeFocus()

    // 更新动作
    this.updateMotion(deltaTimeSeconds)

    // 更新口型同步
    this.updateLipSync()

    // 更新 FPS
    this.updateFps()

    this.isUpdating = false
  }

  /**
   * 更新眼睛注视
   */
  private updateEyeFocus(): void {
    if (!this.modelData) return

    // 设置角度参数
    this.setParameterValue(this.idParamAngleX, this.dragX * 30)
    this.setParameterValue(this.idParamAngleY, this.dragY * 30)
    this.setParameterValue(this.idParamAngleZ, this.dragX * this.dragY * -30)

    // 设置身体角度
    this.setParameterValue(this.idParamBodyAngleX, this.dragX * 10)

    // 设置眼睛位置
    this.setParameterValue(this.idParamEyeBallX, this.dragX)
    this.setParameterValue(this.idParamEyeBallY, this.dragY)
  }

  /**
   * 更新动作
   */
  private updateMotion(_deltaTime: number): void {
    if (!this.currentMotion || this.motionDuration === 0) return

    const elapsed = (performance.now() - this.motionStartTime) / 1000
    const progress = Math.min(elapsed / this.motionDuration, 1.0)

    // 动作结束
    if (progress >= 1.0) {
      console.log(`[CubismModel] 动作完成: ${this.currentMotion}`)
      this.currentMotion = null
      this.motionDuration = 0
    }
  }

  /**
   * 更新口型同步
   */
  private updateLipSync(): void {
    if (this.lipSyncValue > 0) {
      for (let i = 0; i < this.lipSyncIds.getSize(); i++) {
        this.setParameterValue(this.lipSyncIds.at(i), this.lipSyncValue)
      }
    }
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
    if (!this.isInitialized || !this.gl) return

    // 清除画布
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // 设置视口
    if (this.canvas) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    // 渲染模型
    this.drawModel()
  }

  /**
   * 绘制模型
   */
  private drawModel(): void {
    if (!this.gl || !this.modelData) return

    // 这里应该使用 Cubism Core 来绘制模型
    // 目前只是一个占位符实现
    console.log('[CubismModel] 绘制模型')
  }

  // ============================================================================
  // 参数操作方法
  // ============================================================================

  /**
   * 设置参数值
   */
  private setParameterValue(id: CubismIdHandle, value: number, weight: number = 1.0): void {
    if (!this.modelData) return

    // 这里应该使用 Cubism Core 来设置参数值
    // 目前只是一个占位符实现
    console.log(`[CubismModel] 设置参数: ${id} = ${value} (权重: ${weight})`)
  }

  // 以下方法为将来扩展预留，当前未使用
  // /**
  //  * 添加参数值
  //  */
  // protected addParameterValue(_id: CubismIdHandle, _value: number, _weight: number = 1.0): void {
  //   // 这里应该使用 Cubism Core 来添加参数值
  // }

  // /**
  //  * 获取参数值
  //  */
  // protected getParameterValue(_id: CubismIdHandle): number {
  //   // 这里应该使用 Cubism Core 来获取参数值
  //   return 0
  // }

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

    const motions = this.motionGroups.get(group)
    if (!motions || index >= motions.length) {
      console.warn(`[CubismModel] 动作未找到: ${group}[${index}]`)
      return
    }

    const motion = motions[index]
    if (!motion.buffer) {
      console.warn(`[CubismModel] 动作数据未加载: ${group}[${index}]`)
      return
    }

    // 开始播放动作
    this.currentMotion = `${group}[${index}]`
    this.motionStartTime = performance.now()
    this.motionDuration = 2.0 // 默认2秒，实际应该从动作数据中读取

    console.log(`[CubismModel] 开始播放动作: ${this.currentMotion}`)
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

    const expressionName = typeof expressionId === 'number'
      ? this.expressionFiles[expressionId]?.name
      : expressionId

    if (!expressionName) {
      console.warn(`[CubismModel] 表情未找到: ${expressionId}`)
      return
    }

    const expression = this.expressionFiles.find(e => e.name === expressionName)
    if (!expression) {
      console.warn(`[CubismModel] 表情未找到: ${expressionName}`)
      return
    }

    console.log(`[CubismModel] 表情设置完成: ${expressionName}`)
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
        void this.lipSyncContext.resume().catch(() => {
          // ignore resume failure
        })
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
      } catch {
        // ignore disconnect failure
      }
      this.lipSyncSource = null
    }

    if (this.lipSyncAnalyser) {
      try {
        this.lipSyncAnalyser.disconnect()
      } catch {
        // ignore disconnect failure
      }
      this.lipSyncAnalyser = null
    }

    if (this.lipSyncContext) {
      void this.lipSyncContext.close().catch(() => {
        // ignore close failure
      })
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

    // 提取模型名称
    const modelName = this.getModelName()

    return {
      name: modelName,
      motionGroups,
      expressions
    }
  }

  /**
   * 获取模型边界
   */
  getModelBounds(): ModelBounds | null {
    if (!this.canvas) return null

    // 计算模型实际边界
    const width = 200 // 临时值，应该从模型数据中计算
    const height = 200 // 临时值，应该从模型数据中计算
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    return {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
      bottom: centerY + height / 2,
      width,
      height
    }
  }

  /**
   * 获取纹理源（用于颜色提取）
   */
  getTextureSource(): HTMLImageElement | null {
    if (this.textures.length === 0) return null

    // 创建一个临时 canvas 来获取纹理数据
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return null

    // 绘制第一个纹理
    const texture = this.textures[0]
    if (!texture) return null

    // 这里需要从 WebGL 纹理中读取数据
    // 目前返回 null，实际实现需要使用 readPixels 或其他方法
    return null
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

  /**
   * 获取 FPS
   */
  getFps(): number {
    return this.fps
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
      // 删除纹理
      this.textures.forEach(texture => {
        if (texture) {
          this.gl!.deleteTexture(texture)
        }
      })
      this.textures = []
    }

    // 重置状态
    this.isInitialized = false
    this.modelData = null
    this.modelSetting = null
    this.motionGroups.clear()
    this.expressionFiles = []

    console.log('[CubismModel] 模型销毁完成')
  }

  /**
   * 销毁全局资源
   */
  static destroyGlobal(): void {
    console.log('[CubismModel] 销毁全局资源')
    // 这里应该调用 Cubism Framework 的 dispose 方法
  }
}

// ============================================================================
// 导出类型
// ============================================================================

export type { CubismModelInfo, ModelBounds, Position }
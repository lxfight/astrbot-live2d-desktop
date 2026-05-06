/**
 * Live2D Cubism Model 类
 * 基于官方 Cubism SDK for Web 实现
 * 
 * 此类使用真实的 Cubism Framework 来加载和渲染 Live2D 模型
 */

import {
  CubismFramework,
  Option,
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
} from '@cubism-framework'
import { LogLevel } from '@cubism-framework/live2dcubismframework'
import type { CubismIdHandle } from '@cubism-framework/id/cubismid'
import { csmVector } from '@cubism-framework/type/csmvector'
import { csmMap } from '@cubism-framework/type/csmmap'
import { BreathParameterData } from '@cubism-framework/effect/cubismbreath'

import type {
  CubismCompatibilityManifest,
  CubismExpressionCatalogItem,
  CubismExpressionComboItem,
  CubismExpressionRequest,
  CubismExpressionResetPolicy,
  CubismExpressionSemanticItem,
  CubismModelInfo,
  ModelBounds,
  ModelOverlayBounds,
  Position
} from './index'
import type { ExpressionCatalogEntry, ExpressionCatalogInput } from './expressionCatalog'
import type { ParsedExpressionFile } from './exp3Parser'
import type { ExpressionProfile } from './expressionProfile'
import type { CubismModelDiscoverySource } from '@/shared/cubismModelDiscovery'

import {
  isCubism3Model,
  getModelName,
  getTexturePath,
  getMotionPath,
  getExpressionPath,
  getPhysicsPath,
  getPosePath
} from './CubismCore'
import { buildExpressionCatalog } from './expressionCatalog'
import { parseExp3Text } from './exp3Parser'
import { loadExpressionProfile } from './expressionProfile'

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

type LoadedExpressionFile = {
  name: string
  file: string
  aliases: string[]
  source: CubismModelDiscoverySource
  expression?: CubismExpressionMotion
  parsed?: ParsedExpressionFile
  parseWarnings: string[]
}

type ResolvedExpressionDefinition = {
  name: string
  file: string
  aliases: string[]
  source: CubismModelDiscoverySource
}

type ResolvedMotionDefinition = {
  groupName: string
  motions: Array<{ file: string; source: CubismModelDiscoverySource }>
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = String(value || '').trim()
    if (!normalized) {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function mergeExpressionProfileAliases(
  profile: ExpressionProfile | null,
  compatibilityAliases: Record<string, string[]>,
): ExpressionProfile | null {
  const aliasKeys = Object.keys(compatibilityAliases)
  if (!profile && aliasKeys.length === 0) {
    return null
  }

  const mergedAliases: Record<string, string[]> = {
    ...(profile?.aliases ?? {}),
  }

  for (const [id, aliases] of Object.entries(compatibilityAliases)) {
    mergedAliases[id] = uniqueAliases([...(mergedAliases[id] ?? []), ...aliases])
  }

  return {
    ...(profile ?? {}),
    aliases: mergedAliases,
  }
}

type ResolvedExpressionMember = {
  id: string
  weight: number
  order: number
  parsed: ParsedExpressionFile
  conflictGroups: string[]
}

type ActiveExpressionRuntime = {
  members: ResolvedExpressionMember[]
  previous: ResolvedExpressionMember[] | null
  previousLegacyExpressionName: string | null
  holdUntil: number | null
  resetPolicy: CubismExpressionResetPolicy
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
  private static activeInstances = 0

  // WebGL 上下文
  private gl: WebGLRenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private viewportWidth: number = 0
  private viewportHeight: number = 0

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

  private eyeBlinkIds: CubismIdHandle[] = []
  private lipSyncIds: CubismIdHandle[] = []

  // 动画相关
  private lastUpdateTime: number = 0
  private deltaTime: number = 0
  private userTimeSeconds: number = 0

  // 矩阵
  private modelMatrix: CubismModelMatrix | null = null
  private projectionMatrix: CubismMatrix44 = new CubismMatrix44()
  private dragManager: CubismTargetPoint = new CubismTargetPoint()

  // 位置相关
  private modelX: number = 0
  private modelY: number = 0
  private modelScale: number = 1.0

  // 纹理
  private textures: WebGLTexture[] = []

  private static readonly MODEL_BOUNDS_PADDING = 8

  // 动作和表情文件
  private motionGroups: Map<string, Array<{ file: string; motion?: CubismMotion; source: CubismModelDiscoverySource }>> = new Map()
  private expressionFiles: LoadedExpressionFile[] = []
  private expressionCatalogSummary: CubismExpressionCatalogItem[] = []
  private expressionCatalogMap: Map<string, ExpressionCatalogEntry> = new Map()
  private semanticPresets: Record<string, string[]> = {}
  private hasExpressionProfile = false
  private compatibilityManifest: CubismCompatibilityManifest | null = null
  private discoveryInfo: CubismModelInfo['discovery'] | null = null
  private activeExpressionRuntime: ActiveExpressionRuntime | null = null
  private activeLegacyExpressionName: string | null = null
  private hitAreaNames: string[] = []

  // 性能监控
  private frameCount: number = 0
  private fps: number = 0
  private lastFpsUpdate: number = 0
  private destroyed = false

  /**
   * 构造函数
   */
  constructor() {
    CubismModel.ensureFrameworkReady()
    CubismModel.activeInstances += 1
    console.log('[CubismModel] 构造函数')
  }

  /**
   * 从配置文件加载模型
   */
  static async from(modelPath: string, compatibilityManifest?: CubismCompatibilityManifest | null): Promise<CubismModel> {
    const instance = new CubismModel()
    await instance.load(modelPath, compatibilityManifest)
    return instance
  }

  private static ensureFrameworkReady(): void {
    if (!CubismModel.frameworkStarted) {
      const option = new Option()
      option.logFunction = console.log.bind(console)
      option.loggingLevel = LogLevel.LogLevel_Info
      CubismFramework.startUp(option)
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
  async load(modelPath: string, compatibilityManifest?: CubismCompatibilityManifest | null): Promise<void> {
    this.modelPath = modelPath
    this.compatibilityManifest = compatibilityManifest ?? null
    this.discoveryInfo = compatibilityManifest?.discovery ?? null

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

      // 步骤3：初始化眨眼与口型参数 ID
      this.initializeEffectIds()

      // 步骤4：加载表情
      this.state = LoadStep.LoadExpression
      await this.loadExpressions()

      // 步骤5：加载物理
      this.state = LoadStep.LoadPhysics
      await this.loadPhysics()

      // 步骤6：加载姿势
      this.state = LoadStep.LoadPose
      await this.loadPose()

      // 步骤7：加载动作
      this.state = LoadStep.LoadMotion
      await this.loadMotions()

      // 步骤8：设置眼睛眨动
      this.eyeBlink = CubismEyeBlink.create(this.modelSetting)

      const userDataFileName = this.modelSetting.getUserDataFile()
      if (userDataFileName) {
        try {
          const userDataBuffer = await this.loadFileAsArrayBuffer(this.modelHomeDir + userDataFileName)
          this.userModel.loadUserData(userDataBuffer, userDataBuffer.byteLength)
        } catch (error) {
          console.warn('[CubismModel] 用户数据加载失败:', error)
        }
      }

      // 步骤9：设置呼吸效果
      this.breath = CubismBreath.create()
      const breathParameters = new csmVector<BreathParameterData>()
      breathParameters.pushBack(new BreathParameterData(
        CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleX),
        0.0,
        15.0,
        6.5345,
        0.5
      ))
      breathParameters.pushBack(new BreathParameterData(
        CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleY),
        0.0,
        8.0,
        3.5345,
        0.5
      ))
      breathParameters.pushBack(new BreathParameterData(
        CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleZ),
        0.0,
        10.0,
        5.5345,
        0.5
      ))
      breathParameters.pushBack(new BreathParameterData(
        CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBodyAngleX),
        0.0,
        4.0,
        15.5345,
        0.5
      ))
      breathParameters.pushBack(new BreathParameterData(
        CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBreath),
        0.5,
        0.5,
        3.2345,
        0.5
      ))
      this.breath.setParameters(breathParameters)

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

  private async loadFileAsText(filePath: string): Promise<string> {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`无法加载文件: ${filePath} (${response.status})`)
    }
    return await response.text()
  }

  private initializeEffectIds(): void {
    if (!this.modelSetting) return

    const eyeBlinkCount = this.modelSetting.getEyeBlinkParameterCount()
    this.eyeBlinkIds = []
    for (let i = 0; i < eyeBlinkCount; i++) {
      const id = this.modelSetting.getEyeBlinkParameterId(i)
      if (id) {
        this.eyeBlinkIds.push(id)
      }
    }

    const lipSyncCount = this.modelSetting.getLipSyncParameterCount()
    this.lipSyncIds = []
    for (let i = 0; i < lipSyncCount; i++) {
      const id = this.modelSetting.getLipSyncParameterId(i)
      if (id) {
        this.lipSyncIds.push(id)
      }
    }

  }

  private getResolvedExpressionDefinitions(): ResolvedExpressionDefinition[] {
    if (this.compatibilityManifest?.expressions?.length) {
      return this.compatibilityManifest.expressions.map((entry) => ({
        name: entry.id,
        file: entry.file,
        aliases: entry.aliases,
        source: entry.source,
      }))
    }

    if (!this.modelSetting) {
      return []
    }

    const definitions: ResolvedExpressionDefinition[] = []
    const expressionCount = this.modelSetting.getExpressionCount()
    for (let i = 0; i < expressionCount; i++) {
      const expressionFileName = this.modelSetting.getExpressionFileName(i)
      if (!expressionFileName) {
        continue
      }
      const name = expressionFileName.replace(/\.(exp3\.json|json)$/, '')
      definitions.push({
        name,
        file: expressionFileName,
        aliases: [name],
        source: 'model3',
      })
    }
    return definitions
  }

  private getResolvedMotionDefinitions(): ResolvedMotionDefinition[] {
    if (this.compatibilityManifest?.motions && Object.keys(this.compatibilityManifest.motions).length > 0) {
      return Object.entries(this.compatibilityManifest.motions)
        .map(([groupName, motions]) => ({
          groupName,
          motions: motions.map((motion) => ({
            file: motion.file,
            source: motion.source,
          })),
        }))
    }

    if (!this.modelSetting) {
      return []
    }

    const definitions: ResolvedMotionDefinition[] = []
    const motionGroupCount = this.modelSetting.getMotionGroupCount()
    for (let i = 0; i < motionGroupCount; i++) {
      const groupName = this.modelSetting.getMotionGroupName(i)
      const motionCount = this.modelSetting.getMotionCount(groupName)
      const motions: Array<{ file: string; source: CubismModelDiscoverySource }> = []

      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this.modelSetting.getMotionFileName(groupName, j)
        if (motionFileName) {
          motions.push({
            file: motionFileName,
            source: 'model3',
          })
        }
      }

      definitions.push({ groupName, motions })
    }

    return definitions
  }

  /**
   * 加载表情
   */
  private async loadExpressions(): Promise<void> {
    if (!this.modelSetting) return

    this.expressionFiles = []
    this.expressionCatalogSummary = []
    this.expressionCatalogMap.clear()
    this.semanticPresets = {}
    this.hasExpressionProfile = false
    this.activeExpressionRuntime = null
    this.activeLegacyExpressionName = null
    const expressionDefinitions = this.getResolvedExpressionDefinitions()
    if (expressionDefinitions.length === 0) {
      console.log('[CubismModel] 无表情文件')
      return
    }

    console.log(`[CubismModel] 加载 ${expressionDefinitions.length} 个表情`)

    for (const definition of expressionDefinitions) {
      const expressionFileName = definition.file
      const expressionPath = getExpressionPath(this.modelPath, expressionFileName)
      const name = definition.name
      const parseWarnings: string[] = []
      let parsed: ParsedExpressionFile | undefined

      try {
        if (expressionFileName.toLowerCase().endsWith('.exp3.json')) {
          const expressionText = await this.loadFileAsText(expressionPath)
          const parsedCandidate = parseExp3Text(expressionText, name, expressionFileName)
          parseWarnings.push(...parsedCandidate.parseWarnings)
          if (parsedCandidate.parameters.length > 0) {
            parsed = parsedCandidate
          } else {
            parseWarnings.push('表情文件未解析出可执行参数，已回退到原生表情运行时')
          }
        }

        const expressionBuffer = await this.loadFileAsArrayBuffer(expressionPath)
        const expression = this.userModel
          ? this.userModel.loadExpression(expressionBuffer, expressionBuffer.byteLength, name) as CubismExpressionMotion
          : CubismExpressionMotion.create(expressionBuffer, expressionBuffer.byteLength)
        this.expressionFiles.push({
          name,
          file: expressionFileName,
          aliases: definition.aliases,
          source: definition.source,
          expression,
          parsed,
          parseWarnings
        })
        console.log(`[CubismModel] 表情加载成功: ${name}`)
      } catch (error) {
        console.warn(`[CubismModel] 表情加载失败: ${expressionPath}`, error)
        this.expressionFiles.push({
          name,
          file: expressionFileName,
          aliases: definition.aliases,
          source: definition.source,
          parsed,
          parseWarnings
        })
      }
    }

    const profile = await loadExpressionProfile(
      this.modelPath,
      this.compatibilityManifest?.expressionProfileFile,
    )
    const compatibilityAliases = this.expressionFiles.reduce<Record<string, string[]>>((result, entry) => {
      result[entry.name] = uniqueAliases([...(result[entry.name] ?? []), ...entry.aliases])
      return result
    }, {})
    const mergedProfile = mergeExpressionProfileAliases(profile, compatibilityAliases)
    this.hasExpressionProfile = Boolean(profile)

    const parsedExpressions = this.expressionFiles
      .filter((item): item is LoadedExpressionFile & { parsed: ParsedExpressionFile } => Boolean(item.parsed))
      .map<ExpressionCatalogInput>((item) => ({
        parsed: item.parsed,
        source: item.source,
      }))

    const catalogResult = buildExpressionCatalog(parsedExpressions, mergedProfile)
    this.expressionCatalogMap = new Map(
      catalogResult.entries.map((entry) => [entry.id, entry])
    )
    this.expressionCatalogSummary = catalogResult.entries.map((entry) => ({
      id: entry.id,
      aliases: entry.aliases,
      tags: entry.tags,
      conflictGroups: entry.conflictGroups,
      supportsCombo: entry.supportsCombo
    }))
    this.semanticPresets = catalogResult.semanticPresets

    for (const expressionFile of this.expressionFiles) {
      if (!expressionFile.parseWarnings.length) {
        continue
      }
      console.warn(
        `[CubismModel] 表情解析告警: ${expressionFile.name}`,
        expressionFile.parseWarnings
      )
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

    const motionDefinitions = this.getResolvedMotionDefinitions()
    if (motionDefinitions.length === 0) {
      console.log('[CubismModel] 无动作文件')
      return
    }

    console.log(`[CubismModel] 加载 ${motionDefinitions.length} 个动作组`)
    this.hitAreaNames = []

    const hitAreaCount = this.modelSetting.getHitAreasCount()
    for (let i = 0; i < hitAreaCount; i++) {
      this.hitAreaNames.push(this.modelSetting.getHitAreaName(i))
    }

    for (const definition of motionDefinitions) {
      const groupName = definition.groupName
      const motions: Array<{ file: string; motion?: CubismMotion; source: CubismModelDiscoverySource }> = []

      for (let j = 0; j < definition.motions.length; j++) {
        const motionFileName = definition.motions[j].file
        const motionPath = getMotionPath(this.modelPath, motionFileName)

        try {
          const motionBuffer = await this.loadFileAsArrayBuffer(motionPath)
          const canUseModelSettingMotion = definition.motions[j].source === 'model3'
          const motion = this.userModel && canUseModelSettingMotion
            ? this.userModel.loadMotion(
                motionBuffer,
                motionBuffer.byteLength,
                `${groupName}_${j}`,
                undefined,
                undefined,
                this.modelSetting,
                groupName,
                j,
                false
              )
            : CubismMotion.create(motionBuffer, motionBuffer.byteLength)
          if (motion) {
            const eyeBlinkIds = new csmVector<CubismIdHandle>()
            const lipSyncIds = new csmVector<CubismIdHandle>()
            this.eyeBlinkIds.forEach((id) => eyeBlinkIds.pushBack(id))
            this.lipSyncIds.forEach((id) => lipSyncIds.pushBack(id))
            motion.setEffectIds(eyeBlinkIds, lipSyncIds)
          }
          motions.push({
            file: motionFileName,
            source: definition.motions[j].source,
            motion
          })
        } catch (error) {
          console.warn(`[CubismModel] 动作加载失败: ${motionPath}`, error)
          motions.push({
            file: motionFileName,
            source: definition.motions[j].source,
          })
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

    const failedTextures: string[] = []

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
        failedTextures.push(texturePath)
      }
    }

    if (failedTextures.length > 0) {
      throw new Error(`纹理加载失败: ${failedTextures.join(', ')}`)
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
          this.gl!.pixelStorei(this.gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
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
          const canUseMipmaps = this.canUseMipmaps(image.width, image.height)
          if (canUseMipmaps) {
            this.gl!.generateMipmap(this.gl!.TEXTURE_2D)
            this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MIN_FILTER, this.gl!.LINEAR_MIPMAP_LINEAR)
          } else {
            this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MIN_FILTER, this.gl!.LINEAR)
          }
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MAG_FILTER, this.gl!.LINEAR)
          this.gl!.bindTexture(this.gl!.TEXTURE_2D, null)

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

  private normalizeExpressionRequest(
    expression: string | number | CubismExpressionRequest
  ): CubismExpressionRequest {
    if (typeof expression === 'string' || typeof expression === 'number') {
      return { id: expression }
    }
    return expression ?? {}
  }

  private resolveExpressionName(expressionId: string | number | undefined): string | null {
    if (typeof expressionId === 'number') {
      return this.expressionFiles[expressionId]?.name ?? null
    }

    if (typeof expressionId !== 'string') {
      return null
    }

    const normalized = expressionId.trim()
    return normalized || null
  }

  private normalizeExpressionWeight(value: unknown, fallback = 1): number {
    const weight = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(weight)) {
      return fallback
    }
    return Math.min(Math.max(weight, 0), 1)
  }

  private cloneResolvedExpressionMembers(
    members: ResolvedExpressionMember[] | null | undefined
  ): ResolvedExpressionMember[] | null {
    if (!members?.length) {
      return null
    }

    return members.map((member) => ({
      ...member,
      conflictGroups: [...member.conflictGroups]
    }))
  }

  private resolveSemanticComboItems(
    semantic: CubismExpressionSemanticItem[] | undefined
  ): CubismExpressionComboItem[] {
    if (!Array.isArray(semantic) || semantic.length === 0) {
      return []
    }

    const resolved: CubismExpressionComboItem[] = []
    for (const item of semantic) {
      const tag = typeof item?.tag === 'string' ? item.tag.trim() : ''
      if (!tag) {
        continue
      }

      const presetMatches = this.semanticPresets[tag.toLowerCase()] ?? []
      const presetId = presetMatches[0]
      if (!presetId) {
        continue
      }

      resolved.push({
        id: presetId,
        weight: this.normalizeExpressionWeight(item.weight, 1)
      })
    }

    return resolved
  }

  private resolveExpressionMembers(request: CubismExpressionRequest): ResolvedExpressionMember[] {
    const rawItems: Array<{ id: string; weight: number; order: number }> = []

    if (Array.isArray(request.combo) && request.combo.length > 0) {
      request.combo.forEach((item, index) => {
        const id = typeof item?.id === 'string' ? item.id.trim() : ''
        if (!id) {
          return
        }
        rawItems.push({
          id,
          weight: this.normalizeExpressionWeight(item.weight, 1),
          order: index
        })
      })
    } else {
      const expressionName = this.resolveExpressionName(request.id)
      if (expressionName) {
        rawItems.push({
          id: expressionName,
          weight: 1,
          order: 0
        })
      } else {
        this.resolveSemanticComboItems(request.semantic).forEach((item, index) => {
          rawItems.push({
            id: item.id,
            weight: this.normalizeExpressionWeight(item.weight, 1),
            order: index
          })
        })
      }
    }

    const deduped = new Map<string, ResolvedExpressionMember>()
    for (const item of rawItems) {
      const expressionName = this.resolveExpressionName(item.id)
      if (!expressionName) {
        continue
      }

      const expressionFile = this.expressionFiles.find((entry) => entry.name === expressionName)
      if (!expressionFile?.parsed) {
        continue
      }

      const catalogEntry = this.expressionCatalogMap.get(expressionName)
      deduped.set(expressionName, {
        id: expressionName,
        weight: item.weight,
        order: item.order,
        parsed: expressionFile.parsed,
        conflictGroups: [...(catalogEntry?.conflictGroups ?? [])]
      })
    }

    const candidates = [...deduped.values()].sort((left, right) => left.order - right.order)
    if (candidates.length === 0) {
      return []
    }

    const winners = new Map<string, ResolvedExpressionMember>()
    for (const candidate of candidates) {
      for (const group of candidate.conflictGroups) {
        const current = winners.get(group)
        if (
          !current
          || candidate.weight > current.weight
          || (candidate.weight === current.weight && candidate.order >= current.order)
        ) {
          winners.set(group, candidate)
        }
      }
    }

    return candidates.filter((candidate) => (
      candidate.conflictGroups.every((group) => winners.get(group)?.id === candidate.id)
    ))
  }

  private beginCustomExpressionRuntime(
    members: ResolvedExpressionMember[],
    request: CubismExpressionRequest
  ): void {
    const holdMs = typeof request.holdMs === 'number' && Number.isFinite(request.holdMs)
      ? Math.max(0, Math.floor(request.holdMs))
      : 0
    const resetPolicy = request.resetPolicy ?? 'keep'
    const previous = resetPolicy === 'previous'
      ? this.cloneResolvedExpressionMembers(this.activeExpressionRuntime?.members)
      : null
    const previousLegacyExpressionName = resetPolicy === 'previous'
      ? this.activeLegacyExpressionName
      : null

    this.activeExpressionRuntime = {
      members: this.cloneResolvedExpressionMembers(members) ?? [],
      previous,
      previousLegacyExpressionName,
      holdUntil: holdMs > 0 ? Date.now() + holdMs : null,
      resetPolicy
    }
    this.activeLegacyExpressionName = null
  }

  private refreshActiveExpressionRuntime(): void {
    const runtime = this.activeExpressionRuntime
    if (!runtime || runtime.holdUntil === null || Date.now() < runtime.holdUntil) {
      return
    }

    if (runtime.resetPolicy === 'keep') {
      runtime.holdUntil = null
      runtime.previous = null
      runtime.previousLegacyExpressionName = null
      return
    }

    if (runtime.resetPolicy === 'previous' && runtime.previous?.length) {
      this.activeExpressionRuntime = {
        members: this.cloneResolvedExpressionMembers(runtime.previous) ?? [],
        previous: null,
        previousLegacyExpressionName: null,
        holdUntil: null,
        resetPolicy: 'keep'
      }
      return
    }

    if (runtime.resetPolicy === 'previous' && runtime.previousLegacyExpressionName) {
      const previousLegacyExpressionName = runtime.previousLegacyExpressionName
      this.activeExpressionRuntime = null
      this.playLegacyExpressionByName(previousLegacyExpressionName)
      return
    }

    this.activeExpressionRuntime = null
  }

  private applyParsedExpression(model: any, parsed: ParsedExpressionFile, weight: number): void {
    const normalizedWeight = this.normalizeExpressionWeight(weight, 1)
    if (normalizedWeight <= 0) {
      return
    }

    for (const parameter of parsed.parameters) {
      switch (parameter.blend) {
        case 'multiply':
          if (typeof model.multiplyParameterValueById === 'function') {
            model.multiplyParameterValueById(parameter.parameterId, parameter.value, normalizedWeight)
          } else if (typeof model.getParameterValueById === 'function') {
            const currentValue = model.getParameterValueById(parameter.parameterId)
            model.setParameterValueById(parameter.parameterId, currentValue * parameter.value, normalizedWeight)
          }
          break
        case 'overwrite':
          model.setParameterValueById(parameter.parameterId, parameter.value, normalizedWeight)
          break
        case 'add':
        default:
          model.addParameterValueById(parameter.parameterId, parameter.value, normalizedWeight)
          break
      }
    }
  }

  private updateCustomExpressionRuntime(model: any): void {
    this.refreshActiveExpressionRuntime()

    if (!this.activeExpressionRuntime?.members.length) {
      return
    }

    for (const member of this.activeExpressionRuntime.members) {
      this.applyParsedExpression(model, member.parsed, member.weight)
    }
  }

  private clearCustomExpressionRuntime(): void {
    this.activeExpressionRuntime = null
  }

  private playLegacyExpressionByName(expressionName: string): boolean {
    if (!this.expressionManager) {
      console.warn('[CubismModel] 表情管理器未初始化')
      return false
    }

    const expressionData = this.expressionFiles.find((entry) => entry.name === expressionName)
    if (!expressionData?.expression) {
      console.warn(`[CubismModel] 表情未找到: ${expressionName}`)
      return false
    }

    this.clearCustomExpressionRuntime()
    this.activeLegacyExpressionName = expressionName
    this.expressionManager.startMotion(expressionData.expression, false)
    return true
  }

  // ============================================================================
  // WebGL 初始化方法
  // ============================================================================

  /**
   * 初始化 WebGL
   */
  initWebGL(canvas: HTMLCanvasElement, initialPosition?: Position, initialScale: number = 1.0): void {
    console.log('[CubismModel] 初始化 WebGL')

    this.canvas = canvas

    // 获取 WebGL 上下文
    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    }
    const gl = canvas.getContext('webgl2', contextAttributes)
      || canvas.getContext('webgl', contextAttributes)
      || canvas.getContext('experimental-webgl', contextAttributes)
    if (!gl) {
      throw new Error('无法获取 WebGL 上下文')
    }
    this.gl = gl as WebGLRenderingContext

    this.updateCanvasSize(window.innerWidth, window.innerHeight)

    // 创建渲染器
    if (this.userModel) {
      this.userModel.createRenderer()
      this.renderer = this.userModel.getRenderer() as CubismRenderer_WebGL

      if (this.renderer) {
        this.renderer.startUp(this.gl)
        this.renderer.setIsPremultipliedAlpha(true)
      }
    }

    this.modelScale = initialScale
    // 设置模型初始位置和大小
    this.setupModelTransform(initialPosition)
    this.lastUpdateTime = performance.now() / 1000

    this.isInitialized = true
    console.log('[CubismModel] WebGL 初始化完成')
  }

  /**
   * 设置模型变换
   */
  private setupModelTransform(initialPosition?: Position): void {
    if (!this.canvas || !this.userModel) return

    const width = this.getViewportWidth()
    const height = this.getViewportHeight()

    // 获取模型矩阵
    this.modelMatrix = this.userModel.getModelMatrix()

    const model = this.userModel.getModel()

    this.projectionMatrix.loadIdentity()
    if (model && model.getCanvasWidth() > 1.0 && width < height) {
      this.projectionMatrix.scale(1.0, width / height)
    } else {
      this.projectionMatrix.scale(height / width, 1.0)
    }

    // 设置模型矩阵
    if (this.modelMatrix) {
      this.modelMatrix.loadIdentity()

      const layout = new csmMap<string, number>()
      const hasLayout = this.modelSetting?.getLayoutMap(layout) ?? false

      if (hasLayout) {
        this.modelMatrix.setupFromLayout(layout)
      } else if (model && model.getCanvasWidth() > 1.0 && width < height) {
        this.modelMatrix.setWidth(0.72)
      } else {
        this.modelMatrix.setHeight(0.72)
      }

      if (initialPosition) {
        this.modelX = initialPosition.x
        this.modelY = initialPosition.y
        this.modelMatrix.centerX(this.pixelToLogicalX(initialPosition.x))
        this.modelMatrix.centerY(this.pixelToLogicalY(initialPosition.y))
        console.log('[CubismModel] 使用保存的位置:', initialPosition)
      } else {
        this.modelX = width / 2
        this.modelY = height / 2
        this.modelMatrix.centerX(0)
        this.modelMatrix.centerY(0)
        console.log('[CubismModel] 使用默认中心位置')
      }

      this.modelMatrix.scale(this.modelScale, this.modelScale)
    }

    console.log(`[CubismModel] 模型变换设置完成: 画布=${width}x${height}, scale=${this.modelScale}`)
  }

  setModelScale(scale: number): void {
    if (this.modelScale !== scale) {
      this.modelScale = scale
      const position = this.getModelPosition()
      this.setupModelTransform(position ? position : undefined)
    }
  }

  private pixelToLogicalX(pixelX: number): number {
    const viewportWidth = this.getViewportWidth()
    if (viewportWidth <= 0) return 0
    const screenX = (pixelX / viewportWidth) * 2 - 1
    return this.projectionMatrix.invertTransformX(screenX)
  }

  private pixelToLogicalY(pixelY: number): number {
    const viewportHeight = this.getViewportHeight()
    if (viewportHeight <= 0) return 0
    const screenY = 1 - (pixelY / viewportHeight) * 2
    return this.projectionMatrix.invertTransformY(screenY)
  }

  private logicalToPixelX(logicalX: number): number {
    return (logicalX + 1) * this.getViewportWidth() * 0.5
  }

  private logicalToPixelY(logicalY: number): number {
    return (1 - logicalY) * this.getViewportHeight() * 0.5
  }

  private getRenderMatrix(): CubismMatrix44 {
    const matrix = new CubismMatrix44()
    matrix.loadIdentity()
    matrix.setMatrix(this.projectionMatrix.getArray())
    if (this.modelMatrix) {
      matrix.multiplyByMatrix(this.modelMatrix)
    }
    return matrix
  }

  private getDrawableBounds(drawableIndex: number, matrix: CubismMatrix44): ModelBounds | null {
    if (!this.userModel) return null

    const model = this.userModel.getModel()
    const vertexCount = model.getDrawableVertexCount(drawableIndex)
    const vertices = model.getDrawableVertices(drawableIndex)
    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const rawX = vertices[vertexIndex * 2]
      const rawY = vertices[vertexIndex * 2 + 1]
      const transformedX = this.logicalToPixelX(matrix.transformX(rawX))
      const transformedY = this.logicalToPixelY(matrix.transformY(rawY))

      left = Math.min(left, transformedX)
      right = Math.max(right, transformedX)
      top = Math.min(top, transformedY)
      bottom = Math.max(bottom, transformedY)
    }

    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
      return null
    }

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top
    }
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
    this.deltaTime = Math.min(now - this.lastUpdateTime, 0.1)
    this.lastUpdateTime = now
    this.userTimeSeconds += this.deltaTime

    const deltaTimeSeconds = this.deltaTime

    // 更新拖拽管理器
    this.dragManager.update(deltaTimeSeconds)

    const model = this.userModel.getModel()
    model.loadParameters()

    let motionUpdated = false
    if (this.motionManager) {
      if (this.motionManager.isFinished()) {
        // 播放随机待机动作
        if (this.motionGroups.has('Idle')) {
          this.startRandomMotion('Idle', MotionPriority.Idle)
        }
      }
      motionUpdated = this.motionManager.updateMotion(model, deltaTimeSeconds)
    }

    if (!motionUpdated && this.eyeBlink) {
      this.eyeBlink.updateParameters(model, deltaTimeSeconds)
    }

    // 更新表情
    if (this.expressionManager) {
      this.expressionManager.updateMotion(model, deltaTimeSeconds)
    }

    // 更新呼吸效果
    if (this.breath) {
      this.breath.updateParameters(model, deltaTimeSeconds)
    }

    // 更新物理
    if (this.physics) {
      this.physics.evaluate(model, deltaTimeSeconds)
    }

    // 更新姿势
    if (this.pose) {
      this.pose.updateParameters(model, deltaTimeSeconds)
    }

    // 更新眼睛注视
    const dragX = this.dragManager.getX()
    const dragY = this.dragManager.getY()

    // 设置角度参数
    model.addParameterValueById('ParamAngleX', dragX * 30)
    model.addParameterValueById('ParamAngleY', dragY * 30)
    model.addParameterValueById('ParamAngleZ', dragX * dragY * -30)
    model.addParameterValueById('ParamBodyAngleX', dragX * 10)
    model.addParameterValueById('ParamEyeBallX', dragX)
    model.addParameterValueById('ParamEyeBallY', dragY)

    // 保存不含自定义组合表情的基础状态，避免组合参数永久写回
    model.saveParameters()
    this.updateCustomExpressionRuntime(model)
    model.update()

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

    // 设置视口与渲染状态
    if (this.canvas) {
      const viewport = [0, 0, this.canvas.width, this.canvas.height]
      const frameBuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
      this.renderer.setRenderState(frameBuffer, viewport)
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    // 组合 projection × modelMatrix
    const mvpMatrix = this.getRenderMatrix()

    // 设置投影矩阵
    this.renderer.setMvpMatrix(mvpMatrix)

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
    const viewportWidth = this.getViewportWidth()
    const viewportHeight = this.getViewportHeight()
    if (viewportWidth <= 0 || viewportHeight <= 0) return

    // 转换为标准化坐标 (-1 到 1)
    const normalizedX = (x / viewportWidth) * 2 - 1
    const normalizedY = (y / viewportHeight) * 2 - 1

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
  expression(expression: string | number | CubismExpressionRequest): void {
    console.log('[CubismModel] 设置表情:', expression)

    const request = this.normalizeExpressionRequest(expression)
    const resolvedMembers = this.resolveExpressionMembers(request)

    if (resolvedMembers.length > 0) {
      this.expressionManager?.stopAllMotions()
      this.beginCustomExpressionRuntime(resolvedMembers, request)
      return
    }

    const expressionName = this.resolveExpressionName(request.id)
    if (!expressionName) {
      console.warn('[CubismModel] 表情请求未解析为可执行项:', request)
      return
    }

    if (this.playLegacyExpressionByName(expressionName)) {
      return
    }

    console.warn(`[CubismModel] 表情未找到: ${expressionName}`)
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
      expressions,
      capabilities: {
        expressionCombo: this.expressionCatalogSummary.some((entry) => entry.supportsCombo),
        semanticExpression: Object.values(this.semanticPresets).some((items) => items.length > 0),
        expressionProfile: this.hasExpressionProfile
      },
      expressionCatalog: this.expressionCatalogSummary,
      semanticPresets: this.semanticPresets,
      discovery: this.discoveryInfo ?? undefined,
    }
  }

  /**
   * 获取模型边界
   */
  getModelBounds(): ModelBounds | null {
    if (!this.canvas || !this.userModel) return null

    const model = this.userModel.getModel()
    const drawableCount = model.getDrawableCount()
    const renderMatrix = this.getRenderMatrix()
    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    for (let drawableIndex = 0; drawableIndex < drawableCount; drawableIndex++) {
      if (!model.getDrawableDynamicFlagIsVisible(drawableIndex)) {
        continue
      }

      if (model.getDrawableOpacity(drawableIndex) <= 0.01) {
        continue
      }

      const bounds = this.getDrawableBounds(drawableIndex, renderMatrix)
      if (!bounds) {
        continue
      }

      left = Math.min(left, bounds.left)
      right = Math.max(right, bounds.right)
      top = Math.min(top, bounds.top)
      bottom = Math.max(bottom, bounds.bottom)
    }

    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
      return null
    }

    return this.createPaddedBounds(left, right, top, bottom)
  }

  getModelOverlayBounds(): ModelOverlayBounds | null {
    const bounds = this.getModelBounds()
    if (!bounds) {
      return null
    }

    return {
      ...bounds,
      anchorX: (bounds.left + bounds.right) * 0.5,
      topCenterY: bounds.top,
      bottomCenterY: bounds.bottom,
    }
  }

  /**
   * 获取纹理源列表（用于颜色提取）
   */
  getTextureSources(): HTMLCanvasElement[] {
    if (!this.renderer || !this.gl) return []

    try {
      const textures = (this.renderer as any).getBindedTextures?.()
      const textureCount = typeof textures?.getSize === 'function' ? textures.getSize() : 0
      if (!textures || textureCount === 0) return []

      const sources: HTMLCanvasElement[] = []

      // 遍历所有纹理（csmMap 使用 _keyValues 数组而非 forEach）
      const keyValues = textures._keyValues || []
      for (let i = 0; i < keyValues.length; i++) {
        const pair = keyValues[i]
        const glTexture = pair?.second as WebGLTexture | undefined
        if (!glTexture) continue

        try {
          // 创建临时 canvas 来读取纹理数据
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')
          if (!tempCtx) continue

          // 使用固定尺寸（因为 WebGL 不提供直接获取纹理尺寸的方法）
          const width = 512
          const height = 512

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
            continue
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

          sources.push(tempCanvas)
        } catch (e) {
          console.warn(`[CubismModel] 读取纹理 ${i} 失败:`, e)
        }
      }

      return sources
    } catch (e) {
      console.warn('[CubismModel] 获取纹理源失败:', e)
      return []
    }
  }

  /**
   * 获取纹理源（用于颜色提取）
   */
  getTextureSource(): HTMLCanvasElement | null {
    return this.getTextureSources()[0] || null
  }

  /**
   * 检查点是否在模型内
   */
  isPointInModel(x: number, y: number): boolean {
    if (!this.userModel || !this.modelSetting) return false

    const renderMatrix = this.getRenderMatrix()
    const model = this.userModel.getModel()
    const hitAreaCount = this.modelSetting.getHitAreasCount()
    for (let i = 0; i < hitAreaCount; i++) {
      const hitAreaId = this.modelSetting.getHitAreaId(i)
      const drawableIndex = model.getDrawableIndex(hitAreaId)
      if (drawableIndex < 0) {
        continue
      }

      if (!model.getDrawableDynamicFlagIsVisible(drawableIndex)) {
        continue
      }

      if (model.getDrawableOpacity(drawableIndex) <= 0.01) {
        continue
      }

      const bounds = this.getDrawableBounds(drawableIndex, renderMatrix)
      if (bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
        return true
      }
    }

    const bounds = this.getModelBounds()
    if (!bounds) return false

    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
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

    if (this.isInitialized) {
      this.setupModelTransform({ x, y })

      if (this.canvas) {
        const margin = 24
        const bounds = this.getModelBounds()
        const viewportWidth = this.getViewportWidth()
        const viewportHeight = this.getViewportHeight()

        if (bounds) {
          let adjustedX = this.modelX
          let adjustedY = this.modelY

          if (bounds.left < margin) {
            adjustedX += margin - bounds.left
          } else if (bounds.right > viewportWidth - margin) {
            adjustedX -= bounds.right - (viewportWidth - margin)
          }

          if (bounds.top < margin) {
            adjustedY += margin - bounds.top
          } else if (bounds.bottom > viewportHeight - margin) {
            adjustedY -= bounds.bottom - (viewportHeight - margin)
          }

          if (adjustedX !== this.modelX || adjustedY !== this.modelY) {
            this.modelX = adjustedX
            this.modelY = adjustedY
            this.setupModelTransform({ x: adjustedX, y: adjustedY })
          }
        }
      }
    }

    console.log('[CubismModel] 模型位置已设置:', { x: this.modelX, y: this.modelY })
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

    this.updateCanvasSize(width, height)

    // 重新设置模型变换
    this.setupModelTransform({
      x: this.modelX || width / 2,
      y: this.modelY || height / 2
    })

    console.log(`[CubismModel] 画布大小调整为: ${width}x${height}`)
  }

  private getViewportWidth(): number {
    if (this.viewportWidth > 0) {
      return this.viewportWidth
    }

    const canvasWidth = this.canvas?.clientWidth || this.canvas?.width || 0
    return canvasWidth > 0 ? canvasWidth : 0
  }

  private getViewportHeight(): number {
    if (this.viewportHeight > 0) {
      return this.viewportHeight
    }

    const canvasHeight = this.canvas?.clientHeight || this.canvas?.height || 0
    return canvasHeight > 0 ? canvasHeight : 0
  }

  private updateCanvasSize(width: number, height: number): void {
    if (!this.canvas) return

    const safeWidth = Math.max(1, Math.round(width))
    const safeHeight = Math.max(1, Math.round(height))
    const pixelRatio = typeof window === 'undefined' ? 1 : Math.max(window.devicePixelRatio || 1, 1)

    this.viewportWidth = safeWidth
    this.viewportHeight = safeHeight

    this.canvas.style.width = `${safeWidth}px`
    this.canvas.style.height = `${safeHeight}px`
    this.canvas.width = Math.max(1, Math.round(safeWidth * pixelRatio))
    this.canvas.height = Math.max(1, Math.round(safeHeight * pixelRatio))

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  private canUseMipmaps(width: number, height: number): boolean {
    if (!this.gl) {
      return false
    }

    if (typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext) {
      return true
    }

    return this.isPowerOfTwo(width) && this.isPowerOfTwo(height)
  }

  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0
  }

  private createPaddedBounds(left: number, right: number, top: number, bottom: number): ModelBounds {
    const viewportWidth = this.getViewportWidth()
    const viewportHeight = this.getViewportHeight()
    const padding = CubismModel.MODEL_BOUNDS_PADDING
    const clampedLeft = Math.max(0, left - padding)
    const clampedRight = Math.min(viewportWidth, right + padding)
    const clampedTop = Math.max(0, top - padding)
    const clampedBottom = Math.min(viewportHeight, bottom + padding)

    return {
      left: clampedLeft,
      right: clampedRight,
      top: clampedTop,
      bottom: clampedBottom,
      width: clampedRight - clampedLeft,
      height: clampedBottom - clampedTop,
    }
  }

  // ============================================================================
  // 清理方法
  // ============================================================================

  /**
   * 销毁模型
   */
  destroy(): void {
    if (this.destroyed) {
      return
    }

    console.log('[CubismModel] 销毁模型')
    this.destroyed = true

    // 清理 WebGL 资源
    if (this.gl) {
      this.textures.forEach(texture => {
        if (texture) {
          this.gl!.deleteTexture(texture)
        }
      })
      this.textures = []

      const loseContextExtension = this.gl.getExtension('WEBGL_lose_context')
      loseContextExtension?.loseContext()
    }

    // 释放渲染器
    if (this.userModel) {
      this.userModel.release()
      this.userModel = null
    }

    this.renderer = null

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
    this.expressionCatalogSummary = []
    this.expressionCatalogMap.clear()
    this.semanticPresets = {}
    this.hasExpressionProfile = false
    this.compatibilityManifest = null
    this.discoveryInfo = null
    this.activeExpressionRuntime = null
    this.activeLegacyExpressionName = null
    this.hitAreaNames = []
    this.gl = null
    this.canvas = null

    CubismModel.activeInstances = Math.max(0, CubismModel.activeInstances - 1)

    console.log('[CubismModel] 模型销毁完成')
  }

  /**
   * 销毁全局资源
   */
  static destroyGlobal(): void {
    console.log('[CubismModel] 销毁全局资源')

    if (CubismModel.activeInstances > 0) {
      console.warn('[CubismModel] 仍有存活实例，跳过全局资源销毁')
      return
    }

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

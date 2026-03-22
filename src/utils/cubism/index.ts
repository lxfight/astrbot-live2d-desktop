/**
 * Cubism SDK 模块导出
 * 
 * 这个模块提供了 Live2D Cubism SDK 的完整功能
 */

// 主要类
export { CubismModel, LoadStep, MotionPriority, CubismModelSettingJson } from './CubismModel'
export type { ICubismModelSetting } from './CubismModel'

// 核心数据结构
export {
  CubismIdManager,
  csmVector,
  csmMap,
  CubismMatrix44,
  CubismTargetPoint
} from './CubismCore'

export type { CubismIdHandle } from './CubismCore'

// 内存分配器
export type { 
  CubismAllocator, 
  DefaultCubismAllocator, 
  DebugCubismAllocator 
} from './CubismAllocator'
export { createCubismAllocator } from './CubismAllocator'

// 常量
export * from './constants'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 模型信息
 */
export type CubismModelInfo = {
  name: string
  motionGroups: Record<string, Array<{ index: number; file: string }>>
  expressions: string[]
}

/**
 * 模型边界
 */
export type ModelBounds = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

/**
 * 位置
 */
export type Position = {
  x: number
  y: number
}

/**
 * 窗口事件类型
 */
export type WindowEventType =
  | 'focus'      // 窗口获得焦点
  | 'blur'       // 窗口失去焦点
  | 'create'     // 窗口创建
  | 'destroy'    // 窗口销毁
  | 'resize'     // 窗口大小变化
  | 'move'       // 窗口位置变化
  | 'minimize'   // 窗口最小化
  | 'maximize'   // 窗口最大化
  | 'restore'    // 窗口恢复
  | 'fullscreen' // 窗口进入全屏
  | 'windowed'   // 窗口退出全屏

/**
 * 窗口信息
 */
export interface WindowInfo {
  id: string
  title: string
  processName: string
  processPath: string
  processId: number
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  isFullscreen: boolean
  isMinimized: boolean
  isMaximized: boolean
  url?: string
  className?: string
}

/**
 * 窗口事件
 */
export interface WindowEvent {
  type: WindowEventType
  timestamp: number
  window: WindowInfo
  previousWindow?: WindowInfo | null
}

/**
 * 窗口监听器配置
 */
export interface WindowWatcherConfig {
  enabled: boolean
  throttle: {
    globalInterval: number
    perWindowInterval: number
    minInterval: number
  }
  events: {
    focus: boolean
    blur: boolean
    create: boolean
    destroy: boolean
    fullscreen: boolean
    windowed: boolean
    resize: boolean
    move: boolean
    minimize: boolean
    maximize: boolean
    restore: boolean
  }
  ignore: {
    processNames: string[]
    titleKeywords: string[]
  }
  aiResponse: {
    mode: 'first-open' | 'every-switch' | 'specific-apps'
    specificApps: string[]
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查是否为 Cubism 3 模型
 */
export function isCubism3Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model3.json')
}

/**
 * 检查是否为 Cubism 2 模型
 */
export function isCubism2Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model.json') && 
         !modelPath.toLowerCase().endsWith('.model3.json')
}

/**
 * 从模型路径提取模型名称
 */
export function getModelName(modelPath: string): string {
  return modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown'
}

/**
 * 规范化模型路径
 */
export function normalizeModelPath(modelPath: string): string {
  if (!modelPath.startsWith('/')) {
    return '/' + modelPath
  }
  return modelPath
}

/**
 * 构建纹理路径
 */
export function getTexturePath(modelPath: string, textureFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + textureFileName
}

/**
 * 构建动作路径
 */
export function getMotionPath(modelPath: string, motionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + motionFileName
}

/**
 * 构建表情路径
 */
export function getExpressionPath(modelPath: string, expressionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + expressionFileName
}

/**
 * 构建物理路径
 */
export function getPhysicsPath(modelPath: string, physicsFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + physicsFileName
}

/**
 * 构建姿势路径
 */
export function getPosePath(modelPath: string, poseFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + poseFileName
}
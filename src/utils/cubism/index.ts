/**
 * Cubism SDK 模块导出
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

// ============================================================================
// 类型定义
// ============================================================================

export type CubismModelInfo = {
  name: string
  motionGroups: Record<string, Array<{ index: number; file: string }>>
  expressions: string[]
}

export type ModelBounds = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export type ModelOverlayBounds = ModelBounds & {
  anchorX: number
  topCenterY: number
  bottomCenterY: number
}

export type Position = {
  x: number
  y: number
}

export type WindowEventType =
  | 'focus'
  | 'blur'
  | 'create'
  | 'destroy'
  | 'resize'
  | 'move'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'fullscreen'
  | 'windowed'

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

export interface WindowEvent {
  type: WindowEventType
  timestamp: number
  window: WindowInfo
  previousWindow?: WindowInfo | null
}

export interface WindowWatcherConfig {
  enabled: boolean
  appLaunchEnabled: boolean
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
    resize: boolean
    move: boolean
    minimize: boolean
    maximize: boolean
    restore: boolean
    fullscreen: boolean
    windowed: boolean
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

export function isCubism3Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model3.json')
}

export function isCubism2Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model.json') &&
         !modelPath.toLowerCase().endsWith('.model3.json')
}

export function getModelName(modelPath: string): string {
  return modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown'
}

export function normalizeModelPath(modelPath: string): string {
  if (!modelPath.startsWith('/')) {
    return '/' + modelPath
  }
  return modelPath
}

export function getTexturePath(modelPath: string, textureFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + textureFileName
}

export function getMotionPath(modelPath: string, motionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + motionFileName
}

export function getExpressionPath(modelPath: string, expressionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + expressionFileName
}

export function getPhysicsPath(modelPath: string, physicsFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + physicsFileName
}

export function getPosePath(modelPath: string, poseFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + poseFileName
}

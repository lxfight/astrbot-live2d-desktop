/**
 * 动作管理服务
 * 负责管理Live2D模型的动作和表情分配
 */

import { ref, computed } from 'vue'
import { MOTION_TYPES } from '../types/motionManagement'
import type {
  Live2DExpression,
  Live2DMotion,
  MotionAssignment,
  MotionType,
  MotionTypeInfo
} from '../types/motionManagement'
import { logger } from '../utils/logger'
import { modelService } from './modelService'
import type { ModelInfo } from './modelService'

// 本地存储键
const STORAGE_KEY = 'motion_management'
const IDLE_MOTIONS_KEY = 'idle_motions'
const IDLE_EXPRESSIONS_KEY = 'idle_expressions'
const ALIASES_KEY = 'motion_aliases'

type ModelAliasStore = {
  motions?: Record<string, string>
  expressions?: Record<string, string>
}

type AliasStore = {
  version?: string
  models?: Record<string, ModelAliasStore>
}

class MotionManagementService {
  private static instance: MotionManagementService
  
  // 当前加载的模型信息
  private currentModelMotions = ref<Live2DMotion[]>([])
  private currentModelExpressions = ref<Live2DExpression[]>([])
  private currentModelKey = ref<string>('default')
  
  // 动作分配信息
  private motionAssignments = ref<Record<string, MotionAssignment[]>>({})
  private expressionAssignments = ref<Record<string, MotionAssignment[]>>({})
  
  // 待机动作设置
  private idleMotions = ref<MotionAssignment[]>([])
  private idleExpressions = ref<MotionAssignment[]>([])

  // 按模型隔离的别名库
  private aliases = ref<AliasStore>({ version: '1.0.0', models: {} })
  
  private constructor() {
    this.loadFromStorage()
    
    // 监听跨窗口的存储变化
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || 
          e.key === IDLE_MOTIONS_KEY || 
          e.key === IDLE_EXPRESSIONS_KEY || 
          e.key === ALIASES_KEY) {
        this.loadFromStorage()
      }
    })
  }

  private getCurrentModelKey(): string {
    return String(this.currentModelKey.value || '').trim() || 'default'
  }

  private ensureModelAliases(modelKey: string): ModelAliasStore {
    if (!this.aliases.value.models) this.aliases.value.models = {}
    if (!this.aliases.value.models[modelKey]) {
      this.aliases.value.models[modelKey] = { motions: {}, expressions: {} }
    }
    const store = this.aliases.value.models[modelKey]
    if (!store.motions) store.motions = {}
    if (!store.expressions) store.expressions = {}
    return store
  }

  getMotionAlias(motionId: string): string {
    const modelKey = this.getCurrentModelKey()
    const store = this.ensureModelAliases(modelKey)
    return String(store.motions?.[motionId] || '')
  }

  setMotionAlias(motionId: string, alias: string) {
    const modelKey = this.getCurrentModelKey()
    const store = this.ensureModelAliases(modelKey)
    const v = String(alias || '').trim()
    if (!v) {
      delete store.motions?.[motionId]
    } else {
      store.motions![motionId] = v
    }
    this.saveAliasesToStorage()
  }

  getExpressionAlias(expressionId: string): string {
    const modelKey = this.getCurrentModelKey()
    const store = this.ensureModelAliases(modelKey)
    return String(store.expressions?.[expressionId] || '')
  }

  setExpressionAlias(expressionId: string, alias: string) {
    const modelKey = this.getCurrentModelKey()
    const store = this.ensureModelAliases(modelKey)
    const v = String(alias || '').trim()
    if (!v) {
      delete store.expressions?.[expressionId]
    } else {
      store.expressions![expressionId] = v
    }
    this.saveAliasesToStorage()
  }

  getMotionDisplayName(motion: Live2DMotion): string {
    const id = `${motion.group}:${motion.index}`
    const alias = this.getMotionAlias(id)
    return alias || motion.name
  }

  getExpressionDisplayName(expression: Live2DExpression): string {
    const alias = this.getExpressionAlias(expression.id)
    return alias || expression.name
  }
  
  static getInstance(): MotionManagementService {
    if (!MotionManagementService.instance) {
      MotionManagementService.instance = new MotionManagementService()
    }
    return MotionManagementService.instance
  }
  
  /**
   * 设置当前模型的动作和表情
   */
  setModelMotions(motions: Live2DMotion[]) {
    this.currentModelMotions.value = motions
    this.initializeDefaultAssignments()
    this.saveToStorage()
  }
  
  setModelExpressions(expressions: Live2DExpression[]) {
    this.currentModelExpressions.value = expressions
    this.initializeDefaultAssignments()
    this.saveToStorage()
  }

  /**
   * 从当前模型扫描动作和表情
   */
  async scanFromCurrentModel(): Promise<boolean> {
    try {
      const currentModel = await this.getCurrentModelInfo()
      if (!currentModel) {
        logger.warn('没有当前加载的模型')
        return false
      }

      this.currentModelKey.value = String(currentModel.name || '').trim() || 'default'

      // 获取模型文件内容
      const modelData = await this.loadModelData(currentModel.path)
      if (!modelData) {
        logger.error('无法加载模型数据')
        return false
      }

      // 解析动作信息
      const motions = this.extractMotionsFromModel(modelData)
      const expressions = this.extractExpressionsFromModel(modelData)

      this.setModelMotions(motions)
      this.setModelExpressions(expressions)

      logger.info(`从模型扫描到 ${motions.length} 个动作和 ${expressions.length} 个表情`)
      return true
    } catch (error) {
      logger.error('扫描模型动作失败:', error)
      return false
    }
  }

  /**
   * 获取当前模型信息
   */
  private async getCurrentModelInfo(): Promise<ModelInfo | null> {
    try {
      // 尝试从 Electron API 获取当前模型
      if (window.electronAPI?.getCurrentModel) {
        return await window.electronAPI.getCurrentModel()
      }

      // Electron 环境下：从设置读取当前模型名称，避免依赖未实现的 getCurrentModel
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings()
        const currentModelName = settings?.currentModel
        if (currentModelName) {
          return { name: currentModelName, path: `/models/${currentModelName}` }
        }
      }
      
      // 备选方案：尝试获取可用模型的第一个
      const models = await modelService.getAvailableModels()
      return models.length > 0 ? models[0] : null
    } catch (error) {
      logger.error('获取当前模型信息失败:', error)
      return null
    }
  }

  /**
   * 加载模型数据
   */
  private async loadModelData(modelPath: string): Promise<any> {
    try {
      const candidates: string[] = []

      const normalized = String(modelPath || '').trim()
      if (!normalized) {
        throw new Error('模型路径为空')
      }

      // 如果传入的是目录（例如 /models/default），自动探测 model3.json
      if (/\.json(\?.*)?$/i.test(normalized)) {
        candidates.push(normalized)
      } else {
        const base = normalized.replace(/\/+$/, '')
        candidates.push(`${base}/model3.json`)
        candidates.push(`${base}/model.json`)
        candidates.push(base)
      }

      // Electron 环境：优先通过 IPC 读取模型配置（避免 fetch 读到 HTML）
      if (window.electronAPI?.getModelConfig) {
        const match = normalized.match(/\/models\/([^/]+)(?:\/|$)/)
        const modelName = match?.[1]
        if (modelName) {
          const res = await window.electronAPI.getModelConfig(modelName)
          if (res?.success && res.config) {
            return res.config
          }
        }
      }

      for (const url of candidates) {
        try {
          const response = await fetch(url)
          if (!response.ok) {
            continue
          }

          const contentType = response.headers.get('content-type') || ''
          if (!contentType.toLowerCase().includes('application/json')) {
            // 很多情况下会返回 index.html（<!doctype ...），这里做明确提示
            const text = await response.text()
            const preview = text.slice(0, 60).toLowerCase()
            if (preview.includes('<!doctype') || preview.includes('<html')) {
              logger.error(`加载模型数据失败: ${url} 返回 HTML，可能是路径不指向 model3.json 或静态资源未暴露`)
            }
            continue
          }

          return await response.json()
        } catch (e) {
          continue
        }
      }

      throw new Error(`无法加载模型配置，已尝试: ${candidates.join(', ')}`)
    } catch (error) {
      logger.error(`加载模型数据失败: ${modelPath}`, error)
      return null
    }
  }

  /**
   * 从模型数据中提取动作信息
   */
  private extractMotionsFromModel(modelData: any): Live2DMotion[] {
    const motions: Live2DMotion[] = []
    
    try {
      const groups = modelData.FileReferences?.Motions || {}
      
      for (const [groupName, motionGroup] of Object.entries(groups as any)) {
        if (Array.isArray(motionGroup)) {
          motionGroup.forEach((motion: any, index: number) => {
            if (motion && typeof motion === 'object') {
              motions.push({
                group: groupName,
                index: index,
                name: motion.File?.split('/').pop()?.split('.')[0] || `${groupName}_${index}`,
                file: motion.File || ''
              })
            } else if (typeof motion === 'string') {
              motions.push({
                group: groupName,
                index: index,
                name: motion.split('/').pop()?.split('.')[0] || `${groupName}_${index}`,
                file: motion
              })
            }
          })
        }
      }
    } catch (error) {
      logger.error('解析动作数据失败:', error)
    }
    
    return motions
  }

  /**
   * 从模型数据中提取表情信息
   */
  private extractExpressionsFromModel(modelData: any): Live2DExpression[] {
    const expressions: Live2DExpression[] = []
    
    try {
      const exps = modelData.FileReferences?.Expressions || {}
      
      if (Array.isArray(exps)) {
        exps.forEach((exp: any, index: number) => {
          if (exp && typeof exp === 'object') {
            expressions.push({
              id: exp.Id || `expression_${index}`,
              name: exp.Name || `Expression ${index + 1}`,
              file: exp.File || ''
            })
          }
        })
      }
    } catch (error) {
      logger.error('解析表情数据失败:', error)
    }
    
    return expressions
  }
  
  /**
   * 初始化默认分配
   */
  private initializeDefaultAssignments() {
    // 为所有动作类型初始化空数组
    MOTION_TYPES.forEach(type => {
      if (!this.motionAssignments.value[type.id]) {
        this.motionAssignments.value[type.id] = []
      }
      if (!this.expressionAssignments.value[type.id]) {
        this.expressionAssignments.value[type.id] = []
      }
    })
  }
  
  /**
   * 分配动作到类型
   */
  assignMotionToType(motion: Live2DMotion, typeId: string): boolean {
    const type = MOTION_TYPES.find(t => t.id === typeId)
    if (!type) {
      logger.error(`动作类型不存在: ${typeId}`)
      return false
    }
    
    // 检查是否已分配
    const existingIndex = this.motionAssignments.value[typeId]?.findIndex(
      m => m.motionId === `${motion.group}:${motion.index}`
    )
    
    const assignment: MotionAssignment = {
      motionId: `${motion.group}:${motion.index}`,
      motionName: motion.name,
      groupId: motion.group,
      index: motion.index,
      type
    }
    
    if (existingIndex >= 0) {
      this.motionAssignments.value[typeId][existingIndex] = assignment
    } else {
      this.motionAssignments.value[typeId].push(assignment)
    }
    
    this.saveToStorage()
    logger.info(`动作 ${motion.name} 已分配到类型 ${type.name}`)
    return true
  }
  
  /**
   * 分配表情到类型
   */
  assignExpressionToType(expression: Live2DExpression, typeId: string): boolean {
    const type = MOTION_TYPES.find(t => t.id === typeId)
    if (!type) {
      logger.error(`动作类型不存在: ${typeId}`)
      return false
    }
    
    // 检查是否已分配
    const existingIndex = this.expressionAssignments.value[typeId]?.findIndex(
      e => e.motionId === expression.id
    )
    
    const assignment: MotionAssignment = {
      motionId: expression.id,
      motionName: expression.name,
      groupId: 'expression',
      index: 0,
      type
    }
    
    if (existingIndex >= 0) {
      this.expressionAssignments.value[typeId][existingIndex] = assignment
    } else {
      this.expressionAssignments.value[typeId].push(assignment)
    }
    
    this.saveToStorage()
    logger.info(`表情 ${expression.name} 已分配到类型 ${type.name}`)
    return true
  }
  
  /**
   * 从类型中移除动作
   */
  removeMotionFromType(motionId: string, typeId: string): boolean {
    const assignments = this.motionAssignments.value[typeId]
    if (!assignments) return false
    
    const index = assignments.findIndex(m => m.motionId === motionId)
    if (index >= 0) {
      assignments.splice(index, 1)
      this.saveToStorage()
      return true
    }
    return false
  }
  
  /**
   * 从类型中移除表情
   */
  removeExpressionFromType(expressionId: string, typeId: string): boolean {
    const assignments = this.expressionAssignments.value[typeId]
    if (!assignments) return false
    
    const index = assignments.findIndex(e => e.motionId === expressionId)
    if (index >= 0) {
      assignments.splice(index, 1)
      this.saveToStorage()
      return true
    }
    return false
  }
  
  /**
   * 设置待机动作
   */
  setIdleMotions(motions: MotionAssignment[]) {
    this.idleMotions.value = motions
    this.saveToStorage()
  }

  /**
   * 获取待机动作
   */
  getIdleMotions(): MotionAssignment[] {
    return [...this.idleMotions.value]
  }
  
  /**
   * 设置待机表情
   */
  setIdleExpressions(expressions: MotionAssignment[]) {
    this.idleExpressions.value = expressions
    this.saveToStorage()
  }

  /**
   * 获取待机表情
   */
  getIdleExpressions(): MotionAssignment[] {
    return [...this.idleExpressions.value]
  }
  
  /**
   * 根据动作类型获取随机动作
   */
  getRandomMotionForType(typeId: string): MotionAssignment | null {
    const assignments = this.motionAssignments.value[typeId]
    if (!assignments || assignments.length === 0) {
      // 如果该类型没有动作，返回待机动作
      return this.getRandomIdleMotion()
    }
    
    const randomIndex = Math.floor(Math.random() * assignments.length)
    return assignments[randomIndex]
  }
  
  /**
   * 根据动作类型获取随机表情
   */
  getRandomExpressionForType(typeId: string): MotionAssignment | null {
    const assignments = this.expressionAssignments.value[typeId]
    if (!assignments || assignments.length === 0) {
      // 如果该类型没有表情，返回待机表情
      return this.getRandomIdleExpression()
    }
    
    const randomIndex = Math.floor(Math.random() * assignments.length)
    return assignments[randomIndex]
  }
  
  /**
   * 获取随机待机动作
   */
  getRandomIdleMotion(): MotionAssignment | null {
    if (this.idleMotions.value.length === 0) {
      return null
    }
    
    const randomIndex = Math.floor(Math.random() * this.idleMotions.value.length)
    return this.idleMotions.value[randomIndex]
  }
  
  /**
   * 获取随机待机表情
   */
  getRandomIdleExpression(): MotionAssignment | null {
    if (this.idleExpressions.value.length === 0) {
      return null
    }
    
    const randomIndex = Math.floor(Math.random() * this.idleExpressions.value.length)
    return this.idleExpressions.value[randomIndex]
  }
  
  /**
   * 获取未分配的动作
   */
  getUnassignedMotions(): Live2DMotion[] {
    // 旧版语义是“全局未分配（互斥）”。
    // 新需求允许同一动作/表情分配到多个类型，因此不再存在“未分配”互斥集合。
    // 这里保留方法用于兼容旧 UI，直接返回当前模型的全部动作。
    return [...this.currentModelMotions.value]
  }
  
  /**
   * 获取未分配的表情
   */
  getUnassignedExpressions(): Live2DExpression[] {
    return [...this.currentModelExpressions.value]
  }

  /**
   * 获取当前模型的全部动作
   */
  getAllMotions(): Live2DMotion[] {
    return [...this.currentModelMotions.value]
  }

  /**
   * 获取当前模型的全部表情
   */
  getAllExpressions(): Live2DExpression[] {
    return [...this.currentModelExpressions.value]
  }

  /**
   * 判断动作是否已分配到某类型
   */
  isMotionAssignedToType(motion: Live2DMotion, typeId: string): boolean {
    const id = `${motion.group}:${motion.index}`
    return (this.motionAssignments.value[typeId] || []).some(a => a.motionId === id)
  }

  /**
   * 判断表情是否已分配到某类型
   */
  isExpressionAssignedToType(expression: Live2DExpression, typeId: string): boolean {
    return (this.expressionAssignments.value[typeId] || []).some(a => a.motionId === expression.id)
  }

  /**
   * 设置动作在某类型下是否启用（多类型可同时勾选）
   */
  setMotionAssignedToType(motion: Live2DMotion, typeId: string, enabled: boolean): boolean {
    if (enabled) {
      return this.assignMotionToType(motion, typeId)
    }
    return this.removeMotionFromType(`${motion.group}:${motion.index}`, typeId)
  }

  /**
   * 设置表情在某类型下是否启用（多类型可同时勾选）
   */
  setExpressionAssignedToType(expression: Live2DExpression, typeId: string, enabled: boolean): boolean {
    if (enabled) {
      return this.assignExpressionToType(expression, typeId)
    }
    return this.removeExpressionFromType(expression.id, typeId)
  }

  /**
   * 预览播放动作（Electron 环境）
   */
  async previewMotion(group: string, index: number): Promise<boolean> {
    if (!window.electronAPI?.previewMotion) {
      return false
    }
    const res = await window.electronAPI.previewMotion(group, index)
    return !!res?.success
  }

  /**
   * 预览播放表情（Electron 环境）
   */
  async previewExpression(expressionId: string): Promise<boolean> {
    if (!window.electronAPI?.previewExpression) {
      return false
    }
    const res = await window.electronAPI.previewExpression(expressionId)
    return !!res?.success
  }
  
  /**
   * 获取完整的动作类型信息
   */
  getMotionTypeInfo(): MotionTypeInfo {
    return {
      motions: { ...this.motionAssignments.value },
      expressions: { ...this.expressionAssignments.value },
      idleMotions: this.idleMotions.value,
      idleExpressions: this.idleExpressions.value
    }
  }
  
  /**
   * 从本地存储加载数据
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.motionAssignments.value = data.motionAssignments || {}
        this.expressionAssignments.value = data.expressionAssignments || {}
      }

      // 读取别名库（按模型隔离）
      const aliases = localStorage.getItem(ALIASES_KEY)
      if (aliases) {
        const parsed = JSON.parse(aliases)
        if (parsed && typeof parsed === 'object') {
          this.aliases.value = parsed
        }
      }
      
      const idleMotions = localStorage.getItem(IDLE_MOTIONS_KEY)
      if (idleMotions) {
        this.idleMotions.value = JSON.parse(idleMotions)
      }
      
      const idleExpressions = localStorage.getItem(IDLE_EXPRESSIONS_KEY)
      if (idleExpressions) {
        this.idleExpressions.value = JSON.parse(idleExpressions)
      }
      
      logger.info('动作管理配置已从本地存储加载')
    } catch (error) {
      logger.error('加载动作管理配置失败:', error)
    }
  }

  private saveAliasesToStorage() {
    try {
      localStorage.setItem(ALIASES_KEY, JSON.stringify(this.aliases.value))
    } catch (error) {
      logger.error('保存动作/表情别名失败:', error)
    }
  }
  
  /**
   * 保存到本地存储
   */
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        motionAssignments: this.motionAssignments.value,
        expressionAssignments: this.expressionAssignments.value
      }))
      
      localStorage.setItem(IDLE_MOTIONS_KEY, JSON.stringify(this.idleMotions.value))
      localStorage.setItem(IDLE_EXPRESSIONS_KEY, JSON.stringify(this.idleExpressions.value))
      
      logger.debug('动作管理配置已保存到本地存储')
    } catch (error) {
      logger.error('保存动作管理配置失败:', error)
    }
  }
  
  /**
   * 清空所有分配
   */
  clearAllAssignments() {
    this.motionAssignments.value = {}
    this.expressionAssignments.value = {}
    this.idleMotions.value = []
    this.idleExpressions.value = []
    this.initializeDefaultAssignments()
    this.saveToStorage()
    logger.info('所有动作分配已清空')
  }
  
  /**
   * 导出配置
   */
  exportConfig(): string {
    const config = {
      version: '1.0.0',
      timestamp: Date.now(),
      data: {
        motionAssignments: this.motionAssignments.value,
        expressionAssignments: this.expressionAssignments.value,
        idleMotions: this.idleMotions.value,
        idleExpressions: this.idleExpressions.value,
        aliases: this.aliases.value
      }
    }
    
    return JSON.stringify(config, null, 2)
  }
  
  /**
   * 导入配置
   */
  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson)
      
      if (config.data) {
        this.motionAssignments.value = config.data.motionAssignments || {}
        this.expressionAssignments.value = config.data.expressionAssignments || {}
        this.idleMotions.value = config.data.idleMotions || []
        this.idleExpressions.value = config.data.idleExpressions || []

        // aliases 可选，兼容旧格式
        if (config.data.aliases && typeof config.data.aliases === 'object') {
          this.aliases.value = config.data.aliases
          this.saveAliasesToStorage()
        }
        
        this.saveToStorage()
        logger.info('动作管理配置导入成功')
        return true
      }
      
      return false
    } catch (error) {
      logger.error('导入动作管理配置失败:', error)
      return false
    }
  }
}

// 导出服务实例
export const motionService = MotionManagementService.getInstance()

// 导出响应式数据
export const {
  currentModelMotions,
  currentModelExpressions,
  motionAssignments,
  expressionAssignments,
  idleMotions,
  idleExpressions
} = motionService as any

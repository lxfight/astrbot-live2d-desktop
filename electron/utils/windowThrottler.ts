/**
 * 窗口事件节流器
 * 
 * 实现多层节流策略：
 * 1. 全局频率限制
 * 2. 单窗口频率限制
 * 3. 应用打开检测（首次打开才触发）
 * 4. 特定应用检测
 */

import type { WindowWatcherConfig, WindowEventType } from './windowWatcherConfig'
import { getMergedIgnoreRules } from './windowWatcherConfig'
import type { WindowEvent } from './windowWatcher'

/**
 * 窗口事件节流器
 */
export class WindowThrottler {
  private config: WindowWatcherConfig
  private mergedIgnoreRules: { processNames: string[]; titleKeywords: string[] }
  
  // 全局节流：上次触发时间
  private lastGlobalTrigger: number = 0
  
  // 单窗口节流：每个窗口的上次触发时间
  private perWindowTimestamps: Map<string, number> = new Map()
  
  // 已见过的进程（用于 first-open 模式）
  private seenProcesses: Set<string> = new Set()
  
  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null
  
  constructor(config: WindowWatcherConfig) {
    this.config = config
    this.mergedIgnoreRules = getMergedIgnoreRules(config)
    this.startCleanupTimer()
  }
  
  /**
   * 检查是否应该触发 AI 回调
   */
  shouldTrigger(event: WindowEvent): { shouldTrigger: boolean; reason?: string } {
    const now = Date.now()
    
    // 1. 检查事件类型是否启用
    if (!this.isEventEnabled(event.type)) {
      return { shouldTrigger: false, reason: `事件类型 ${event.type} 未启用` }
    }
    
    // 2. 检查是否在忽略列表中
    if (this.shouldIgnoreEvent(event)) {
      return { shouldTrigger: false, reason: '在忽略列表中' }
    }
    
    // 3. 最小间隔检查
    const minInterval = this.config.throttle.minInterval
    if (now - this.lastGlobalTrigger < minInterval) {
      return { shouldTrigger: false, reason: `小于最小间隔 ${minInterval}ms` }
    }
    
    // 4. 全局频率限制
    const globalInterval = this.config.throttle.globalInterval
    if (now - this.lastGlobalTrigger < globalInterval) {
      return { shouldTrigger: false, reason: `小于全局间隔 ${globalInterval}ms` }
    }
    
    // 5. 单窗口频率限制
    const windowId = event.window.id
    const lastWindowTrigger = this.perWindowTimestamps.get(windowId) || 0
    const perWindowInterval = this.config.throttle.perWindowInterval
    if (now - lastWindowTrigger < perWindowInterval) {
      return { shouldTrigger: false, reason: `小于单窗口间隔 ${perWindowInterval}ms` }
    }
    
    // 6. AI 响应模式检查
    const modeCheck = this.checkAIResponseMode(event, now)
    if (!modeCheck.shouldTrigger) {
      return modeCheck
    }
    
    // 更新时间戳
    this.lastGlobalTrigger = now
    this.perWindowTimestamps.set(windowId, now)
    
    return { shouldTrigger: true }
  }
  
  /**
   * 检查事件类型是否启用
   */
  private isEventEnabled(type: WindowEventType): boolean {
    return this.config.events[type] ?? false
  }
  
  /**
   * 检查是否应该忽略
   */
  shouldIgnoreEvent(event: WindowEvent): boolean {
    const { processName, title } = event.window
    
    // 检查进程名（使用合并后的规则）
    if (this.mergedIgnoreRules.processNames.includes(processName)) {
      return true
    }
    
    // 检查标题关键词（使用合并后的规则）
    const lowerTitle = title.toLowerCase()
    for (const keyword of this.mergedIgnoreRules.titleKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return true
      }
    }
    
    // 忽略空标题
    if (!title.trim()) {
      return true
    }
    
    return false
  }
  
  /**
   * 检查 AI 响应模式
   */
  private checkAIResponseMode(event: WindowEvent, _now: number): { shouldTrigger: boolean; reason?: string } {
    const { mode, specificApps } = this.config.aiResponse
    const processKey = `${event.window.processName}-${event.window.processId}`
    
    switch (mode) {
      case 'first-open':
        // 仅首次打开应用时响应
        if (this.seenProcesses.has(processKey)) {
          return { shouldTrigger: false, reason: '非首次打开' }
        }
        this.seenProcesses.add(processKey)
        return { shouldTrigger: true }
      
      case 'every-switch':
        // 每次应用切换都响应
        return { shouldTrigger: true }
      
      case 'specific-apps':
        // 仅检测到特定应用时响应
        if (!specificApps.includes(event.window.processName)) {
          return { shouldTrigger: false, reason: '非特定应用' }
        }
        return { shouldTrigger: true }
      
      default:
        return { shouldTrigger: true }
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: WindowWatcherConfig): void {
    this.config = config
    this.mergedIgnoreRules = getMergedIgnoreRules(config)
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): WindowWatcherConfig {
    return { ...this.config }
  }
  
  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now()
    const expireTime = 24 * 60 * 60 * 1000  // 24小时
    
    // 清理过期的窗口记录
    for (const [windowId, timestamp] of this.perWindowTimestamps) {
      if (now - timestamp > expireTime) {
        this.perWindowTimestamps.delete(windowId)
      }
    }
    
    // 限制 seenProcesses 大小
    if (this.seenProcesses.size > 1000) {
      const entries = Array.from(this.seenProcesses)
      this.seenProcesses = new Set(entries.slice(-500))
    }
  }
  
  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每小时清理一次
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000)
  }
  
  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
  
  /**
   * 销毁节流器
   */
  destroy(): void {
    this.stopCleanupTimer()
    this.perWindowTimestamps.clear()
    this.seenProcesses.clear()
  }
}

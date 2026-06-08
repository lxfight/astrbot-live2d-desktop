/**
 * Live2D 模型资源缓存管理器
 * 优化模型资源加载性能，减少重复加载
 */

interface CachedResource {
  data: ArrayBuffer
  timestamp: number
  size: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  count: number
}

/**
 * 模型资源缓存
 * - 缓存纹理、动作、表情等二进制资源
 * - 自动清理过期缓存
 * - 内存使用监控
 */
export class ModelResourceCache {
  private cache = new Map<string, CachedResource>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    count: 0
  }

  // 配置
  private maxCacheSize = 100 * 1024 * 1024 // 100MB
  private maxAge = 30 * 60 * 1000 // 30分钟
  private cleanupInterval = 5 * 60 * 1000 // 5分钟清理一次

  private cleanupTimer: number | null = null

  constructor(options?: { maxCacheSize?: number; maxAge?: number; cleanupInterval?: number }) {
    if (options?.maxCacheSize) this.maxCacheSize = options.maxCacheSize
    if (options?.maxAge) this.maxAge = options.maxAge
    if (options?.cleanupInterval) this.cleanupInterval = options.cleanupInterval

    this.startCleanup()
  }

  /**
   * 获取缓存资源
   */
  get(url: string): ArrayBuffer | null {
    const cached = this.cache.get(url)
    if (!cached) {
      this.stats.misses++
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.remove(url)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return cached.data
  }

  /**
   * 添加资源到缓存
   */
  set(url: string, data: ArrayBuffer): void {
    const size = data.byteLength

    // 检查单个资源是否超过缓存限制
    if (size > this.maxCacheSize * 0.5) {
      console.warn(`[资源缓存] 资源过大，不缓存: ${url} (${(size / 1024 / 1024).toFixed(2)}MB)`)
      return
    }

    // 如果添加后超出限制，先清理
    while (this.stats.size + size > this.maxCacheSize && this.cache.size > 0) {
      this.evictOldest()
    }

    // 添加到缓存
    const existing = this.cache.get(url)
    if (existing) {
      this.stats.size -= existing.size
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now(),
      size
    })

    this.stats.size += size
    this.stats.count = this.cache.size
  }

  /**
   * 移除指定资源
   */
  remove(url: string): boolean {
    const cached = this.cache.get(url)
    if (!cached) return false

    this.cache.delete(url)
    this.stats.size -= cached.size
    this.stats.count = this.cache.size
    return true
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.stats.size = 0
    this.stats.count = 0
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? this.stats.hits / total : 0

    return {
      ...this.stats,
      hitRate
    }
  }

  /**
   * 预加载资源
   */
  async preload(urls: string[]): Promise<void> {
    const promises = urls.map(async url => {
      if (this.cache.has(url)) return

      try {
        const response = await fetch(url)
        if (!response.ok) return

        const data = await response.arrayBuffer()
        this.set(url, data)
      } catch (error) {
        console.warn(`[资源缓存] 预加载失败: ${url}`, error)
      }
    })

    await Promise.all(promises)
  }

  /**
   * 驱逐最老的缓存项
   */
  private evictOldest(): void {
    let oldest: string | null = null
    let oldestTime = Date.now()

    for (const [url, cached] of this.cache.entries()) {
      if (cached.timestamp < oldestTime) {
        oldest = url
        oldestTime = cached.timestamp
      }
    }

    if (oldest) {
      this.remove(oldest)
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.maxAge) {
        toRemove.push(url)
      }
    }

    for (const url of toRemove) {
      this.remove(url)
    }

    if (toRemove.length > 0) {
      console.log(`[资源缓存] 清理了 ${toRemove.length} 个过期资源`)
    }
  }

  /**
   * 启动定时清理
   */
  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup()
    }, this.cleanupInterval)
  }

  /**
   * 停止定时清理
   */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.clear()
  }
}

// 全局单例
let globalCache: ModelResourceCache | null = null

export function getGlobalModelResourceCache(): ModelResourceCache {
  if (!globalCache) {
    globalCache = new ModelResourceCache()
  }
  return globalCache
}

export function destroyGlobalModelResourceCache(): void {
  if (globalCache) {
    globalCache.destroy()
    globalCache = null
  }
}

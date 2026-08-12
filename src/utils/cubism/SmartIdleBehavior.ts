/**
 * 智能空闲行为系统
 *
 * 在 IdleAnimator 的基础上，增加更自然的行为：
 * - 随机眨眼（符合人类眨眼频率）
 * - 偶尔的随机动作（看向侧边、伸懒腰等）
 * - 时间感知（早上打招呼、晚上说晚安）
 */

export interface SmartIdleConfig {
  /** 眨眼平均间隔（秒），默认 3-5 秒 */
  blinkIntervalMin?: number
  blinkIntervalMax?: number
  /** 随机动作平均间隔（秒），默认 30-90 秒 */
  randomMotionIntervalMin?: number
  randomMotionIntervalMax?: number
  /** 是否启用时间感知行为 */
  enableTimeAwareness?: boolean
  /** 时间感知检查间隔（秒），默认 60 秒 */
  timeCheckInterval?: number
}

export interface SmartIdleEvent {
  type: 'blink' | 'randomMotion' | 'timeGreeting'
  data?: {
    motionGroup?: string
    motionIndex?: number
    /** 当前时段，由调用方决定问候文案 */
    period?: TimePeriod
  }
}

type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night'

const DEFAULT_CONFIG: Required<SmartIdleConfig> = {
  blinkIntervalMin: 3,
  blinkIntervalMax: 5,
  randomMotionIntervalMin: 30,
  randomMotionIntervalMax: 90,
  enableTimeAwareness: true,
  timeCheckInterval: 60
}

/**
 * 智能空闲行为管理器
 */
export class SmartIdleBehavior {
  private config: Required<SmartIdleConfig>
  private enabled = true
  private time = 0
  private nextBlinkTime = 0
  private nextRandomMotionTime = 0
  private nextTimeCheckTime = 0
  private lastTimePeriod: TimePeriod | null = null
  private eventQueue: SmartIdleEvent[] = []

  constructor(config: SmartIdleConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.scheduleNextBlink()
    this.scheduleNextRandomMotion()
    this.scheduleNextTimeCheck()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 推进时间并生成事件
   */
  advance(deltaSeconds: number): SmartIdleEvent[] {
    if (!this.enabled) {
      return []
    }

    this.eventQueue = []
    this.time += deltaSeconds

    // 检查眨眼
    if (this.time >= this.nextBlinkTime) {
      this.eventQueue.push({ type: 'blink' })
      this.scheduleNextBlink()
    }

    // 检查随机动作
    if (this.time >= this.nextRandomMotionTime) {
      const motion = this.selectRandomMotion()
      this.eventQueue.push({
        type: 'randomMotion',
        data: motion
      })
      this.scheduleNextRandomMotion()
    }

    // 检查时间感知
    if (this.config.enableTimeAwareness && this.time >= this.nextTimeCheckTime) {
      const event = this.checkTimeAwareness()
      if (event) {
        this.eventQueue.push(event)
      }
      this.scheduleNextTimeCheck()
    }

    return this.eventQueue
  }

  /**
   * 获取当前时间段
   */
  private getCurrentTimePeriod(): TimePeriod {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 18) return 'afternoon'
    if (hour >= 18 && hour < 22) return 'evening'
    return 'night'
  }

  /**
   * 检查时间感知行为
   */
  private checkTimeAwareness(): SmartIdleEvent | null {
    const period = this.getCurrentTimePeriod()
    if (period === this.lastTimePeriod) {
      return null
    }

    this.lastTimePeriod = period

    return {
      type: 'timeGreeting',
      data: { period }
    }
  }

  /**
   * 选择随机动作
   */
  private selectRandomMotion(): { motionGroup?: string; motionIndex?: number } {
    const motions = [
      { motionGroup: 'Idle', motionIndex: 0 },
      { motionGroup: 'TapBody', motionIndex: 0 }
    ]
    return motions[Math.floor(Math.random() * motions.length)]
  }

  /**
   * 安排下次眨眼时间
   */
  private scheduleNextBlink(): void {
    const interval =
      this.config.blinkIntervalMin +
      Math.random() * (this.config.blinkIntervalMax - this.config.blinkIntervalMin)
    this.nextBlinkTime = this.time + interval
  }

  /**
   * 安排下次随机动作时间
   */
  private scheduleNextRandomMotion(): void {
    const interval =
      this.config.randomMotionIntervalMin +
      Math.random() * (this.config.randomMotionIntervalMax - this.config.randomMotionIntervalMin)
    this.nextRandomMotionTime = this.time + interval
  }

  /**
   * 安排下次时间检查
   */
  private scheduleNextTimeCheck(): void {
    this.nextTimeCheckTime = this.time + this.config.timeCheckInterval
  }

  /**
   * 重置计时器（例如用户交互后）
   */
  reset(): void {
    this.time = 0
    this.scheduleNextBlink()
    this.scheduleNextRandomMotion()
    this.scheduleNextTimeCheck()
  }
}

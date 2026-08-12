/**
 * 定时提醒调度器
 *
 * 支持健康提醒（久坐、喝水、护眼等）和自定义提醒
 */

export interface ReminderConfig {
  id: string
  /** 提醒类型 */
  type: 'sitting' | 'water' | 'eye' | 'custom'
  /** 提醒间隔（分钟） */
  intervalMinutes: number
  /** 提醒消息 */
  message: string
  /** 是否启用 */
  enabled: boolean
  /** 仅在工作时间提醒（9:00-18:00） */
  workingHoursOnly?: boolean
}

export interface ReminderEvent {
  id: string
  type: string
  message: string
  timestamp: number
}

const DEFAULT_REMINDERS: ReminderConfig[] = [
  {
    id: 'sitting',
    type: 'sitting',
    intervalMinutes: 60,
    message: '已经坐了一个小时了，站起来活动一下吧~',
    enabled: false,
    workingHoursOnly: true
  },
  {
    id: 'water',
    type: 'water',
    intervalMinutes: 90,
    message: '该喝水啦！保持水分很重要哦~',
    enabled: false,
    workingHoursOnly: true
  },
  {
    id: 'eye',
    type: 'eye',
    intervalMinutes: 45,
    message: '眼睛休息一下吧，看看远处放松一下~',
    enabled: false,
    workingHoursOnly: true
  }
]

/**
 * 定时提醒调度器
 */
export class ReminderScheduler {
  private reminders: Map<string, ReminderConfig> = new Map()
  private nextReminderTimes: Map<string, number> = new Map()
  private time = 0
  private enabled = true

  constructor(customReminders: ReminderConfig[] = []) {
    // 加载默认提醒
    DEFAULT_REMINDERS.forEach(reminder => {
      this.reminders.set(reminder.id, { ...reminder })
    })

    // 加载自定义提醒
    customReminders.forEach(reminder => {
      this.reminders.set(reminder.id, { ...reminder })
    })

    // 初始化下次提醒时间
    this.reminders.forEach((reminder, id) => {
      if (reminder.enabled) {
        this.scheduleNext(id)
      }
    })
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 添加或更新提醒配置
   */
  setReminder(config: ReminderConfig): void {
    this.reminders.set(config.id, { ...config })
    if (config.enabled) {
      this.scheduleNext(config.id)
    } else {
      this.nextReminderTimes.delete(config.id)
    }
  }

  /**
   * 移除提醒
   */
  removeReminder(id: string): void {
    this.reminders.delete(id)
    this.nextReminderTimes.delete(id)
  }

  /**
   * 获取所有提醒配置
   */
  getReminders(): ReminderConfig[] {
    return Array.from(this.reminders.values())
  }

  /**
   * 推进时间并检查提醒
   */
  advance(deltaSeconds: number): ReminderEvent[] {
    if (!this.enabled) {
      return []
    }

    this.time += deltaSeconds
    const events: ReminderEvent[] = []

    this.reminders.forEach((reminder, id) => {
      if (!reminder.enabled) {
        return
      }

      const nextTime = this.nextReminderTimes.get(id)
      if (nextTime !== undefined && this.time >= nextTime) {
        // 检查是否在工作时间
        if (reminder.workingHoursOnly && !this.isWorkingHours()) {
          this.scheduleNext(id)
          return
        }

        events.push({
          id: reminder.id,
          type: reminder.type,
          message: reminder.message,
          timestamp: Date.now()
        })

        this.scheduleNext(id)
      }
    })

    return events
  }

  /**
   * 安排下次提醒时间
   */
  private scheduleNext(id: string): void {
    const reminder = this.reminders.get(id)
    if (!reminder) {
      return
    }

    const intervalSeconds = reminder.intervalMinutes * 60
    this.nextReminderTimes.set(id, this.time + intervalSeconds)
  }

  /**
   * 检查当前是否为工作时间（9:00-18:00）
   */
  private isWorkingHours(): boolean {
    const hour = new Date().getHours()
    return hour >= 9 && hour < 18
  }

  /**
   * 暂停某个提醒（延后到下个周期）
   */
  snooze(id: string, minutes: number = 10): void {
    const currentNext = this.nextReminderTimes.get(id)
    if (currentNext !== undefined) {
      this.nextReminderTimes.set(id, this.time + minutes * 60)
    }
  }

  /**
   * 重置所有计时器
   */
  reset(): void {
    this.time = 0
    this.nextReminderTimes.clear()
    this.reminders.forEach((reminder, id) => {
      if (reminder.enabled) {
        this.scheduleNext(id)
      }
    })
  }
}

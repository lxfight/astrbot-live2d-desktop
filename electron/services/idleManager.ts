/**
 * 待机管理器 - 管理 Idle 动作循环播放
 */

export interface IdleMotion {
  group: string
  index: number
}

export class IdleManager {
  private idleMotions: IdleMotion[] = []
  private currentMotion: IdleMotion | null = null
  private isActive = false

  setIdleMotions(motionIds: string[]) {
    this.idleMotions = motionIds.map(id => {
      const [group, indexStr] = id.split('_')
      return {
        group,
        index: parseInt(indexStr, 10) || 0
      }
    })

    console.log(`[IdleManager] Set ${this.idleMotions.length} idle motions`)
  }

  start(
    startMotionCallback: (group: string, index: number, priority: number, loop: boolean) => void
  ) {
    if (this.isActive) {
      console.log('[IdleManager] Already active')
      return
    }

    this.isActive = true
    console.log('[IdleManager] Starting idle mode')

    if (this.idleMotions.length === 0) {
      console.log('[IdleManager] No idle motions configured, idle mode disabled')
      return
    }

    // 随机选择一个 Idle 动作循环播放
    const randomIndex = Math.floor(Math.random() * this.idleMotions.length)
    this.currentMotion = this.idleMotions[randomIndex]

    console.log(
      `[IdleManager] Playing idle motion: ${this.currentMotion.group}_${this.currentMotion.index}`
    )

    startMotionCallback(
      this.currentMotion.group,
      this.currentMotion.index,
      1, // priority: 1 (低优先级)
      true // loop: true
    )
  }

  stop(stopMotionCallback: () => void) {
    if (!this.isActive) {
      return
    }

    console.log('[IdleManager] Stopping idle mode')
    this.isActive = false

    if (this.currentMotion) {
      stopMotionCallback()
      this.currentMotion = null
    }
  }

  isRunning(): boolean {
    return this.isActive
  }
}

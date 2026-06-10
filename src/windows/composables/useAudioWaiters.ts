/**
 * 音频播放结束等待器（从 Main.vue 抽出）
 *
 * 表演队列播放音频时通过 waitForNextAudioEnd 挂起，
 * 由 MediaPlayer 的 audioEnd 事件（或超时）唤醒，保证序列按音频时长推进。
 */

const AUDIO_END_TIMEOUT_MS = 30000

type AudioWaiter = {
  resolve: () => void
  timeoutId: number | null
}

export function useAudioWaiters() {
  let audioWaiters: AudioWaiter[] = []

  function settleAudioWaiter(waiter: AudioWaiter) {
    if (waiter.timeoutId !== null) {
      clearTimeout(waiter.timeoutId)
      waiter.timeoutId = null
    }
    waiter.resolve()
  }

  function waitForNextAudioEnd(timeoutMs = AUDIO_END_TIMEOUT_MS): Promise<void> {
    return new Promise(resolve => {
      const waiter: AudioWaiter = {
        resolve,
        timeoutId: null
      }

      waiter.timeoutId = window.setTimeout(() => {
        audioWaiters = audioWaiters.filter(item => item !== waiter)
        settleAudioWaiter(waiter)
      }, timeoutMs)

      audioWaiters.push(waiter)
    })
  }

  function resolveNextAudioWaiter() {
    const waiter = audioWaiters.shift()
    if (waiter) {
      settleAudioWaiter(waiter)
    }
  }

  function releaseAllAudioWaiters() {
    while (audioWaiters.length > 0) {
      const waiter = audioWaiters.shift()
      if (waiter) {
        settleAudioWaiter(waiter)
      }
    }
  }

  return {
    waitForNextAudioEnd,
    resolveNextAudioWaiter,
    releaseAllAudioWaiters
  }
}

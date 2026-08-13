/**
 * hello-plugin 示例入口
 * 宿主注入的 api 对象提供 storage / notifications / fetch / log 能力，
 * 能力是否可用取决于 manifest.json 中声明的 permissions。
 *
 * 返回可选对象 { onDisable } 供宿主在停用时调用做清理。
 */
module.exports = function main(api) {
  let disposed = false

  // 1. 读取设置（宿主已按 schema 合并默认值，这里直接读）
  api.storage
    .get('greeting')
    .then(greeting => {
      api.log.info('hello-plugin 启动，问候语:', greeting)
    })
    .catch(error => {
      api.log.warn('读取问候语失败:', error)
    })

  // 2. 启动通知演示（需要 notifications 权限）
  async function greet() {
    if (disposed) return
    const greeting = await api.storage.get('greeting')
    const notifyOnMessage = await api.storage.get('notifyOnMessage')
    if (notifyOnMessage) {
      await api.notifications.show('你好，插件', String(greeting ?? '你好~'))
    } else {
      api.log.info('通知已关闭，问候语:', greeting)
    }
  }
  void greet()

  // 3. 定时器演示：进程内 setTimeout 直接可用，无需 timers 权限
  const timer = setInterval(() => {
    if (disposed) return
    api.log.info('hello-plugin 心跳（每分钟一次）')
  }, 60_000)

  return {
    onDisable() {
      disposed = true
      clearInterval(timer)
      api.log.info('hello-plugin 已停用，清理完成')
    }
  }
}

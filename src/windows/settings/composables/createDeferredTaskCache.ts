export type DeferredTaskLoader = () => Promise<void> | void

export function createDeferredTaskCache() {
  const tasks = new Map<string, Promise<void>>()

  function invalidate(keys?: string[]) {
    if (!keys) {
      tasks.clear()
      return
    }

    for (const key of keys) {
      tasks.delete(key)
    }
  }

  function runTask(key: string, loader: DeferredTaskLoader, force = false): Promise<void> {
    if (force) {
      tasks.delete(key)
    }

    const existingTask = tasks.get(key)
    if (existingTask) {
      return existingTask
    }

    const task = Promise.resolve(loader())
      .catch((error) => {
        tasks.delete(key)
        throw error
      })

    tasks.set(key, task)
    return task
  }

  return {
    invalidate,
    runTask,
  }
}

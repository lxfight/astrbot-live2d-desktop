export type WindowKind = 'main' | 'settings' | 'history' | 'welcome' | 'unknown'

const WINDOW_KIND_CLASS_PREFIX = 'window-kind-'

export function resolveWindowKindFromHash(hash: string): WindowKind {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash

  if (normalizedHash.startsWith('/settings')) {
    return 'settings'
  }
  if (normalizedHash.startsWith('/history')) {
    return 'history'
  }
  if (normalizedHash.startsWith('/welcome')) {
    return 'welcome'
  }
  if (normalizedHash.startsWith('/main') || normalizedHash === '/' || normalizedHash === '') {
    return 'main'
  }

  return 'unknown'
}

export function applyWindowKindClasses(kind: WindowKind): void {
  if (typeof document === 'undefined' || !document.body) {
    return
  }

  const classNames = [
    `${WINDOW_KIND_CLASS_PREFIX}main`,
    `${WINDOW_KIND_CLASS_PREFIX}settings`,
    `${WINDOW_KIND_CLASS_PREFIX}history`,
    `${WINDOW_KIND_CLASS_PREFIX}welcome`,
    `${WINDOW_KIND_CLASS_PREFIX}unknown`,
  ]

  document.documentElement.classList.remove(...classNames)
  document.body.classList.remove(...classNames)

  const nextClassName = `${WINDOW_KIND_CLASS_PREFIX}${kind}`
  document.documentElement.classList.add(nextClassName)
  document.body.classList.add(nextClassName)
  document.body.dataset.windowKind = kind
}

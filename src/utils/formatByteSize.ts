const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  let formatted: string
  if (exponent === 0) {
    formatted = String(Math.round(value))
  } else if (value >= 100) {
    formatted = value.toFixed(0)
  } else if (value >= 10) {
    formatted = value.toFixed(1)
  } else if (Number.isInteger(value)) {
    formatted = value.toFixed(0)
  } else {
    formatted = value.toFixed(1)
  }
  return `${formatted} ${UNITS[exponent]}`
}

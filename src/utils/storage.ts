type JsonObject = Record<string, unknown>

interface ReadStorageOptions<T> {
  fallback: T
  normalize?: (value: unknown) => T
  version?: number
  migrate?: (value: unknown) => T
  onError?: (error: unknown) => void
}

interface WriteStorageOptions {
  version?: number
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function unwrapVersionedPayload(value: unknown, expectedVersion?: number): unknown {
  if (!expectedVersion || !isJsonObject(value)) {
    return value
  }

  if (value.version === expectedVersion && 'data' in value) {
    return value.data
  }

  return value
}

export function readJsonStorage<T>(key: string, options: ReadStorageOptions<T>): T {
  const { fallback, normalize, version, migrate, onError } = options

  try {
    const rawValue = localStorage.getItem(key)
    if (!rawValue) {
      return fallback
    }

    const parsed = JSON.parse(rawValue)
    const unwrapped = unwrapVersionedPayload(parsed, version)

    if (normalize) {
      return normalize(unwrapped)
    }

    if (migrate) {
      return migrate(unwrapped)
    }

    return unwrapped as T
  } catch (error) {
    onError?.(error)
    return fallback
  }
}

export function writeJsonStorage<T>(key: string, value: T, options: WriteStorageOptions = {}): void {
  const { version } = options
  const payload = version
    ? { version, data: value }
    : value

  localStorage.setItem(key, JSON.stringify(payload))
}

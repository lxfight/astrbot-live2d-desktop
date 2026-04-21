export interface ResourceUrlConfig {
  resourceBaseUrl?: string
  resourcePath?: string
  resourceToken?: string
}

export interface ResourceLike {
  url?: string
  inline?: string
  rid?: string
}

const LEGACY_DEFAULT_RESOURCE_BASE_URL = 'http://127.0.0.1:9091'
const DEFAULT_RESOURCE_PATH = '/resources'
const ALLOWED_RESOURCE_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:', 'history-resource:'])

export function normalizeResourceBaseUrl(resourceBaseUrl?: string): string {
  const baseUrl = (resourceBaseUrl || LEGACY_DEFAULT_RESOURCE_BASE_URL).trim()
  return baseUrl.replace(/\/+$/, '')
}

export function normalizeResourcePath(resourcePath?: string): string {
  const trimmedPath = (resourcePath || DEFAULT_RESOURCE_PATH).trim()
  const normalized = trimmedPath.replace(/^\/+|\/+$/g, '')
  return normalized ? `/${normalized}` : DEFAULT_RESOURCE_PATH
}

function normalizeResourceToken(resourceToken?: string): string {
  return (resourceToken || '').trim()
}

function normalizeResourceRid(rid: string): string {
  const normalizedRid = rid
    .trim()
    .replace(/\\+/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (normalizedRid.length === 0) {
    throw new Error('资源标识不能为空')
  }

  if (normalizedRid.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('资源标识包含非法路径片段')
  }

  return normalizedRid.map((segment) => encodeURIComponent(segment)).join('/')
}

function shouldPreferRidUrl(config: ResourceUrlConfig): boolean {
  const baseUrl = (config.resourceBaseUrl || '').trim()
  const path = (config.resourcePath || '').trim()
  return Boolean(baseUrl || (path && normalizeResourcePath(path) !== DEFAULT_RESOURCE_PATH))
}

function withResourceToken(url: string, resourceToken?: string): string {
  const token = normalizeResourceToken(resourceToken)
  if (!token) {
    return url
  }

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('token', token)
    return parsed.toString()
  } catch {
    return url
  }
}

function normalizeDirectResourceUrl(rawUrl: string): string | null {
  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) {
    return null
  }

  try {
    const parsed = new URL(trimmedUrl)
    if (!ALLOWED_RESOURCE_PROTOCOLS.has(parsed.protocol)) {
      return null
    }

    if (parsed.protocol === 'data:' && !trimmedUrl.startsWith('data:')) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

export function isDirectResourceUrl(rawUrl: string): boolean {
  return normalizeDirectResourceUrl(rawUrl) !== null
}

function normalizeInlineResource(inline: string): string | null {
  const normalizedInline = inline.trim()
  if (!normalizedInline) {
    return null
  }

  return normalizedInline.startsWith('data:') ? normalizedInline : null
}

export function resolveResourceRidUrl(rid: string, config: ResourceUrlConfig = {}): string {
  const normalizedRid = normalizeResourceRid(rid)
  const baseUrl = `${normalizeResourceBaseUrl(config.resourceBaseUrl)}${normalizeResourcePath(config.resourcePath)}/${normalizedRid}`
  return withResourceToken(baseUrl, config.resourceToken)
}

export function resolveResourceSource(resource: ResourceLike, config: ResourceUrlConfig = {}): string | null {
  const inline = typeof resource.inline === 'string' ? normalizeInlineResource(resource.inline) : null
  if (inline) {
    return inline
  }

  const rid = typeof resource.rid === 'string' ? resource.rid.trim() : ''
  if (rid && shouldPreferRidUrl(config)) {
    try {
      return resolveResourceRidUrl(rid, config)
    } catch {
      return null
    }
  }

  const url = typeof resource.url === 'string' ? normalizeDirectResourceUrl(resource.url) : null
  if (url) {
    return url
  }

  if (!rid) {
    return null
  }

  try {
    return resolveResourceRidUrl(rid, config)
  } catch {
    return null
  }
}

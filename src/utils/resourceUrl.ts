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

export function resolveResourceRidUrl(rid: string, config: ResourceUrlConfig = {}): string {
  const normalizedRid = encodeURIComponent(rid.trim())
  const baseUrl = `${normalizeResourceBaseUrl(config.resourceBaseUrl)}${normalizeResourcePath(config.resourcePath)}/${normalizedRid}`
  return withResourceToken(baseUrl, config.resourceToken)
}

export function resolveResourceSource(resource: ResourceLike, config: ResourceUrlConfig = {}): string | null {
  const inline = typeof resource.inline === 'string' ? resource.inline.trim() : ''
  if (inline) {
    return inline
  }

  const rid = typeof resource.rid === 'string' ? resource.rid.trim() : ''
  if (rid && shouldPreferRidUrl(config)) {
    return resolveResourceRidUrl(rid, config)
  }

  const url = typeof resource.url === 'string' ? resource.url.trim() : ''
  if (url) {
    return url
  }

  if (!rid) {
    return null
  }

  return resolveResourceRidUrl(rid, config)
}

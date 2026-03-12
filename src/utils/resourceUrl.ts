export interface ResourceUrlConfig {
  resourceBaseUrl?: string
  resourcePath?: string
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

export function resolveResourceRidUrl(rid: string, config: ResourceUrlConfig = {}): string {
  const normalizedRid = rid.trim()
  return `${normalizeResourceBaseUrl(config.resourceBaseUrl)}${normalizeResourcePath(config.resourcePath)}/${normalizedRid}`
}

export function resolveResourceSource(resource: ResourceLike, config: ResourceUrlConfig = {}): string | null {
  const inline = typeof resource.inline === 'string' ? resource.inline.trim() : ''
  if (inline) {
    return inline
  }

  const url = typeof resource.url === 'string' ? resource.url.trim() : ''
  if (url) {
    return url
  }

  const rid = typeof resource.rid === 'string' ? resource.rid.trim() : ''
  if (!rid) {
    return null
  }

  return resolveResourceRidUrl(rid, config)
}

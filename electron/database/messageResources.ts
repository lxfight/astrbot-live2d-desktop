import { createHash } from 'crypto'
import path from 'path'
import { net } from 'electron'
import type { HistoryResourceContext } from '../../src/shared/history'
import { decodeBinaryPayload, decodeInlineDataUrl } from '../protocol/messageContent'
import { getDatabase } from './schema'

export const HISTORY_RESOURCE_PROTOCOL_SCHEME = 'history-resource'

type ResourceElement = {
  type?: unknown
  url?: unknown
  inline?: unknown
  rid?: unknown
  bytes?: unknown
  mime?: unknown
  name?: unknown
} & Record<string, unknown>

type PreparedStoredResource = {
  contentIndex: number
  mediaType: string
  mime: string
  fileName: string
  sizeBytes: number
  sha256: string
  sourceKind: 'bytes' | 'inline' | 'url' | 'rid'
  sourceUrl: string | null
  sourceRid: string | null
  data: Buffer
}

type MessageResourceRow = {
  id: number
  mime: string
  file_name: string | null
  size_bytes: number
  data: Buffer
}

export interface LocalizeMessageContentOptions {
  forceReplaceResources?: boolean
  resourceContext?: HistoryResourceContext
  strict?: boolean
}

export interface LocalizeMessageContentResult {
  content: any[]
  changed: boolean
}

const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'file', 'tts'])
const HISTORY_RESOURCE_PROTOCOL = `${HISTORY_RESOURCE_PROTOCOL_SCHEME}:`
const REMOTE_PROTOCOLS = new Set(['http:', 'https:'])
const DEFAULT_RESOURCE_PATH = '/resources'
const FALLBACK_FILE_NAMES: Record<string, string> = {
  image: 'image.bin',
  audio: 'audio.bin',
  tts: 'audio.bin',
  video: 'video.bin',
  file: 'file.bin',
}
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'text/plain': '.txt',
}

function cloneResourceElement(item: unknown): ResourceElement {
  if (item && typeof item === 'object') {
    return { ...(item as Record<string, unknown>) }
  }

  return { type: 'text', text: item }
}

function normalizeMediaType(type: unknown): string | null {
  const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : ''
  if (!normalizedType || !MEDIA_TYPES.has(normalizedType)) {
    return null
  }

  return normalizedType === 'tts' ? 'audio' : normalizedType
}

function normalizeFileName(rawName: unknown, fallback: string): string {
  if (typeof rawName !== 'string') {
    return fallback
  }

  const baseName = path.basename(rawName.trim()).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  return baseName || fallback
}

function ensureFileExtension(fileName: string, mime: string): string {
  if (path.extname(fileName)) {
    return fileName
  }

  const extension = MIME_EXTENSION_MAP[mime.toLowerCase()] || ''
  return `${fileName}${extension}`
}

function buildFallbackFileName(type: string, mime: string, preferredName?: unknown): string {
  const fallback = FALLBACK_FILE_NAMES[type] || 'resource.bin'
  const normalizedName = normalizeFileName(preferredName, fallback)
  return ensureFileExtension(normalizedName, mime)
}

function normalizeMime(rawMime: unknown, fallbackType: string): string {
  if (typeof rawMime === 'string' && rawMime.trim()) {
    return rawMime.split(';')[0].trim().toLowerCase() || 'application/octet-stream'
  }

  if (fallbackType === 'image') return 'image/png'
  if (fallbackType === 'audio') return 'audio/webm'
  if (fallbackType === 'video') return 'video/mp4'
  return 'application/octet-stream'
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

function normalizeResourceBaseUrl(resourceBaseUrl?: string): string {
  return (resourceBaseUrl || '').trim().replace(/\/+$/, '')
}

function normalizeResourcePath(resourcePath?: string): string {
  const trimmedPath = (resourcePath || DEFAULT_RESOURCE_PATH).trim()
  const normalized = trimmedPath.replace(/^\/+|\/+$/g, '')
  return normalized ? `/${normalized}` : DEFAULT_RESOURCE_PATH
}

function withResourceToken(url: string, resourceToken?: string): string {
  const normalizedToken = (resourceToken || '').trim()
  if (!normalizedToken) {
    return url
  }

  const parsed = new URL(url)
  parsed.searchParams.set('token', normalizedToken)
  return parsed.toString()
}

function resolveRidSourceUrl(rid: string, resourceContext?: HistoryResourceContext): string | null {
  const baseUrl = normalizeResourceBaseUrl(resourceContext?.resourceBaseUrl)
  if (!baseUrl) {
    return null
  }

  const normalizedRid = normalizeResourceRid(rid)
  const resourceUrl = `${baseUrl}${normalizeResourcePath(resourceContext?.resourcePath)}/${normalizedRid}`
  return withResourceToken(resourceUrl, resourceContext?.resourceToken)
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith('data:')
}

function isHistoryResourceUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith(HISTORY_RESOURCE_PROTOCOL)
}

function isRemoteResourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const parsed = new URL(value.trim())
    return REMOTE_PROTOCOLS.has(parsed.protocol)
  } catch {
    return false
  }
}

function parseContentDispositionFileName(headerValue: string | null): string | null {
  if (!headerValue) {
    return null
  }

  const encodedMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return encodedMatch[1]
    }
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || null
}

function inferFileNameFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl)
    const baseName = path.basename(parsed.pathname)
    return baseName && baseName !== '/' ? baseName : null
  } catch {
    return null
  }
}

function buildResourceSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function finalizeLocalizedElement(element: ResourceElement, resourceId: number, fileName: string): ResourceElement {
  const localizedElement = { ...element }
  localizedElement.url = buildHistoryResourceUrl(resourceId, fileName)
  localizedElement.name = buildFallbackFileName(normalizeMediaType(element.type) || 'file', normalizeMime(element.mime, 'file'), fileName)
  delete localizedElement.inline
  delete localizedElement.rid
  delete localizedElement.bytes
  delete localizedElement.mime
  return localizedElement
}

function resolveResourceSourceUrl(element: ResourceElement, resourceContext?: HistoryResourceContext): { sourceUrl: string | null; sourceKind: 'url' | 'rid' | null } {
  const rawUrl = typeof element.url === 'string' ? element.url.trim() : ''
  if (isRemoteResourceUrl(rawUrl)) {
    return { sourceUrl: rawUrl, sourceKind: 'url' }
  }

  const rawRid = typeof element.rid === 'string' ? element.rid.trim() : ''
  if (rawRid) {
    return {
      sourceUrl: resolveRidSourceUrl(rawRid, resourceContext),
      sourceKind: 'rid',
    }
  }

  return { sourceUrl: null, sourceKind: null }
}

async function fetchRemoteResource(sourceUrl: string): Promise<{ buffer: Buffer; mime: string; fileName: string | null }> {
  const response = await net.fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`资源请求失败 (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    buffer,
    mime: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'application/octet-stream',
    fileName: parseContentDispositionFileName(response.headers.get('content-disposition')) || inferFileNameFromUrl(sourceUrl),
  }
}

function getPreparedInlineResource(element: ResourceElement): { buffer: Buffer; mime: string; fileName: string; sourceKind: 'bytes' | 'inline' } | null {
  const bytesResource = decodeBinaryPayload({
    type: 'file',
    bytes: element.bytes as any,
    mime: typeof element.mime === 'string' ? element.mime : undefined,
  } as any)

  if (bytesResource) {
    const mediaType = normalizeMediaType(element.type) || 'file'
    const mime = normalizeMime(bytesResource.mime, mediaType)
    return {
      buffer: bytesResource.buffer,
      mime,
      fileName: buildFallbackFileName(mediaType, mime, element.name),
      sourceKind: 'bytes',
    }
  }

  const inlineCandidate = typeof element.inline === 'string'
    ? element.inline
    : (isDataUrl(element.url) ? String(element.url) : '')
  const inlineResource = decodeInlineDataUrl(inlineCandidate)
  if (!inlineResource) {
    return null
  }

  const mediaType = normalizeMediaType(element.type) || 'file'
  const mime = normalizeMime(inlineResource.mime, mediaType)
  return {
    buffer: inlineResource.buffer,
    mime,
    fileName: buildFallbackFileName(mediaType, mime, element.name),
    sourceKind: 'inline',
  }
}

function getMessageResourceRowById(resourceId: number): MessageResourceRow | null {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, mime, file_name, size_bytes, data
    FROM message_resources
    WHERE id = ?
  `).get(resourceId) as MessageResourceRow | null
}

function replaceMessageResources(messageId: string, resources: PreparedStoredResource[]): Map<number, number> {
  const db = getDatabase()
  const insertedIds = new Map<number, number>()
  const insertStatement = db.prepare(`
    INSERT INTO message_resources (
      message_id, content_index, media_type, mime, file_name,
      size_bytes, sha256, source_kind, source_url, source_rid, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM message_resources WHERE message_id = ?').run(messageId)

    for (const resource of resources) {
      const result = insertStatement.run(
        messageId,
        resource.contentIndex,
        resource.mediaType,
        resource.mime,
        resource.fileName,
        resource.sizeBytes,
        resource.sha256,
        resource.sourceKind,
        resource.sourceUrl,
        resource.sourceRid,
        resource.data,
      )
      insertedIds.set(resource.contentIndex, Number(result.lastInsertRowid))
    }
  })

  transaction()
  return insertedIds
}

function buildPreparedRemoteResource(
  element: ResourceElement,
  contentIndex: number,
  mediaType: string,
  sourceKind: 'url' | 'rid',
  sourceUrl: string,
  fetchedResource: { buffer: Buffer; mime: string; fileName: string | null },
): PreparedStoredResource {
  const mime = normalizeMime(fetchedResource.mime || element.mime, mediaType)
  const fileName = buildFallbackFileName(mediaType, mime, element.name || fetchedResource.fileName)

  return {
    contentIndex,
    mediaType,
    mime,
    fileName,
    sizeBytes: fetchedResource.buffer.length,
    sha256: buildResourceSha256(fetchedResource.buffer),
    sourceKind,
    sourceUrl: sourceKind === 'url' ? sourceUrl : null,
    sourceRid: sourceKind === 'rid' && typeof element.rid === 'string' ? element.rid.trim() : null,
    data: fetchedResource.buffer,
  }
}

function buildPreparedInlineStoredResource(
  contentIndex: number,
  mediaType: string,
  inlineResource: { buffer: Buffer; mime: string; fileName: string; sourceKind: 'bytes' | 'inline' },
): PreparedStoredResource {
  return {
    contentIndex,
    mediaType,
    mime: inlineResource.mime,
    fileName: inlineResource.fileName,
    sizeBytes: inlineResource.buffer.length,
    sha256: buildResourceSha256(inlineResource.buffer),
    sourceKind: inlineResource.sourceKind,
    sourceUrl: null,
    sourceRid: null,
    data: inlineResource.buffer,
  }
}

export function buildHistoryResourceUrl(resourceId: number, fileName?: string): string {
  const normalizedFileName = encodeURIComponent(normalizeFileName(fileName, 'resource.bin'))
  return `${HISTORY_RESOURCE_PROTOCOL_SCHEME}://resource/${resourceId}/${normalizedFileName}`
}

export function parseHistoryResourceUrl(rawUrl: string): { resourceId: number } | null {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== HISTORY_RESOURCE_PROTOCOL || parsed.hostname !== 'resource') {
      return null
    }

    const [resourceIdSegment] = parsed.pathname.split('/').filter(Boolean)
    const resourceId = Number(resourceIdSegment)
    if (!Number.isInteger(resourceId) || resourceId <= 0) {
      return null
    }

    return { resourceId }
  } catch {
    return null
  }
}

export function getMessageResourceByUrl(rawUrl: string): MessageResourceRow | null {
  const parsed = parseHistoryResourceUrl(rawUrl)
  if (!parsed) {
    return null
  }

  return getMessageResourceRowById(parsed.resourceId)
}

export function getMessageResourceById(resourceId: number): MessageResourceRow | null {
  return getMessageResourceRowById(resourceId)
}

export async function localizeMessageContent(
  messageId: string,
  content: unknown,
  options: LocalizeMessageContentOptions = {},
): Promise<LocalizeMessageContentResult> {
  const items = Array.isArray(content) ? content : [content]
  const localizedItems = items.map((item) => cloneResourceElement(item))
  const pendingResources: PreparedStoredResource[] = []
  let changed = false
  let containsExistingLocalResource = false
  let repairFailed = false

  for (let index = 0; index < localizedItems.length; index += 1) {
    const localizedItem = localizedItems[index]
    const mediaType = normalizeMediaType(localizedItem.type)
    if (!mediaType) {
      continue
    }

    if (isHistoryResourceUrl(localizedItem.url)) {
      containsExistingLocalResource = true
      continue
    }

    const inlineResource = getPreparedInlineResource(localizedItem)
    if (inlineResource) {
      pendingResources.push(buildPreparedInlineStoredResource(index, mediaType, inlineResource))
      changed = true
      continue
    }

    const { sourceUrl, sourceKind } = resolveResourceSourceUrl(localizedItem, options.resourceContext)
    if (!sourceUrl || !sourceKind) {
      if (options.strict && (
        typeof localizedItem.rid === 'string'
        || typeof localizedItem.url === 'string'
      )) {
        throw new Error(`消息资源无法解析为可下载地址: ${localizedItem.name || localizedItem.type || index}`)
      }
      repairFailed = true
      continue
    }

    try {
      const fetchedResource = await fetchRemoteResource(sourceUrl)
      pendingResources.push(buildPreparedRemoteResource(localizedItem, index, mediaType, sourceKind, sourceUrl, fetchedResource))
      changed = true
    } catch (error) {
      if (options.strict) {
        throw error
      }
      repairFailed = true
    }
  }

  if (repairFailed) {
    return { content: localizedItems, changed: false }
  }

  if (containsExistingLocalResource && pendingResources.length > 0) {
    if (options.strict) {
      throw new Error('消息同时包含已本地化资源和待离线化资源，拒绝混合写入')
    }
    return { content: localizedItems, changed: false }
  }

  if (options.forceReplaceResources && !containsExistingLocalResource) {
    const insertedIds = replaceMessageResources(messageId, pendingResources)
    for (const resource of pendingResources) {
      const resourceId = insertedIds.get(resource.contentIndex)
      if (!resourceId) {
        continue
      }
      localizedItems[resource.contentIndex] = finalizeLocalizedElement(localizedItems[resource.contentIndex], resourceId, resource.fileName)
    }
    return { content: localizedItems, changed: changed || pendingResources.length === 0 }
  }

  if (!changed) {
    return { content: localizedItems, changed: false }
  }

  const insertedIds = replaceMessageResources(messageId, pendingResources)
  for (const resource of pendingResources) {
    const resourceId = insertedIds.get(resource.contentIndex)
    if (!resourceId) {
      continue
    }
    localizedItems[resource.contentIndex] = finalizeLocalizedElement(localizedItems[resource.contentIndex], resourceId, resource.fileName)
  }

  return { content: localizedItems, changed: true }
}

import { protocol } from 'electron'
import {
  HISTORY_RESOURCE_PROTOCOL_SCHEME,
  getMessageResourceById,
  parseHistoryResourceUrl,
} from '../database/messageResources'

protocol.registerSchemesAsPrivileged([
  {
    scheme: HISTORY_RESOURCE_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

let historyResourceProtocolRegistered = false

function buildNotFoundResponse(message: string): Response {
  return new Response(message, { status: 404 })
}

function buildRangeNotSatisfiableResponse(size: number): Response {
  return new Response('Requested Range Not Satisfiable', {
    status: 416,
    headers: {
      'Content-Range': `bytes */${size}`,
      'Accept-Ranges': 'bytes',
    },
  })
}

function buildBaseHeaders(mime: string, fileName: string | null, size: number): Headers {
  const headers = new Headers()
  headers.set('Content-Type', mime || 'application/octet-stream')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Length', String(size))

  if (fileName) {
    headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  }

  return headers
}

function parseRangeHeader(rangeHeader: string | null, size: number): { start: number; end: number } | null {
  if (!rangeHeader) {
    return null
  }

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i)
  if (!match) {
    return null
  }

  let start = match[1] ? Number(match[1]) : NaN
  let end = match[2] ? Number(match[2]) : NaN

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return null
  }

  if (Number.isNaN(start)) {
    const suffixLength = end
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null
    }
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else if (Number.isNaN(end)) {
    end = size - 1
  }

  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end < start
    || start >= size
  ) {
    return null
  }

  return {
    start,
    end: Math.min(end, size - 1),
  }
}

export function registerHistoryResourceProtocol(): void {
  if (historyResourceProtocolRegistered) {
    return
  }

  historyResourceProtocolRegistered = true

  protocol.handle(HISTORY_RESOURCE_PROTOCOL_SCHEME, async (request) => {
    const parsed = parseHistoryResourceUrl(request.url)
    if (!parsed) {
      return buildNotFoundResponse('Invalid history resource URL')
    }

    const resource = getMessageResourceById(parsed.resourceId)
    if (!resource) {
      return buildNotFoundResponse('History resource not found')
    }

    const buffer = Buffer.from(resource.data)
    const size = buffer.length
    const baseHeaders = buildBaseHeaders(resource.mime, resource.file_name, size)
    const range = parseRangeHeader(request.headers.get('range'), size)

    if (request.headers.get('range') && !range) {
      return buildRangeNotSatisfiableResponse(size)
    }

    if (!range) {
      return new Response(buffer, {
        status: 200,
        headers: baseHeaders,
      })
    }

    const partialBuffer = buffer.subarray(range.start, range.end + 1)
    baseHeaders.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    baseHeaders.set('Content-Length', String(partialBuffer.length))

    return new Response(partialBuffer, {
      status: 206,
      headers: baseHeaders,
    })
  })
}

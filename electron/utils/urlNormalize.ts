/**
 * WS/WSS ↔ HTTP/HTTPS 协议转换工具。
 * 供 renderer（connection store）和 main（bridge client）共用。
 */

export function wsToHttpProtocol(protocol: string): string {
  if (protocol === 'wss:') return 'https:'
  return 'http:'
}

export function deriveHttpBaseUrlFromWsUrl(rawUrl: string, fallback = 'http://127.0.0.1:9090'): string {
  try {
    const parsed = new URL(rawUrl)
    parsed.protocol = wsToHttpProtocol(parsed.protocol)
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

export function resolveHttpUrl(rawUrl: string, wsBaseUrl: string): string {
  try {
    return new URL(rawUrl).toString()
  } catch {
    const base = deriveHttpBaseUrlFromWsUrl(wsBaseUrl)
    return new URL(rawUrl, base).toString()
  }
}

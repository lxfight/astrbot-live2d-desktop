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

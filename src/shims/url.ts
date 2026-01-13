export type LegacyParsedUrl = {
  href?: string
  protocol?: string
  slashes?: boolean
  auth?: string
  host?: string
  hostname?: string
  port?: string
  pathname?: string
  search?: string
  hash?: string
}

function getBaseHref(): string | undefined {
  try {
    return globalThis.location?.href
  } catch {
    return undefined
  }
}

function isAbsoluteLike(input: string): boolean {
  return /^(?:[a-zA-Z][a-zA-Z\d+.-]*:)?\/\//.test(input) || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)
}

function stripQueryHash(input: string): string {
  return input.split('#')[0].split('?')[0]
}

function normalizePath(pathname: string): string {
  const hasLeadingSlash = pathname.startsWith('/')
  const segments = pathname.split('/').filter(Boolean)
  const out: string[] = []

  for (const seg of segments) {
    if (seg === '.') continue
    if (seg === '..') {
      out.pop()
      continue
    }
    out.push(seg)
  }

  return (hasLeadingSlash ? '/' : '') + out.join('/')
}

export function parse(input: string): LegacyParsedUrl {
  const base = getBaseHref()

  try {
    const url = base ? new URL(input, base) : new URL(input)
    return {
      href: url.href,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      host: url.host,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash
    }
  } catch {
    return { href: input }
  }
}

export function resolve(from: string, to: string): string {
  // 1) 目标本身就是绝对 URL / 协议相对 URL
  if (isAbsoluteLike(to)) return to

  // 2) 目标是根路径（如 /models/xxx）
  if (to.startsWith('/')) return to

  // 3) base 是标准绝对 URL（带协议），用 URL 直接解析
  if (isAbsoluteLike(from)) {
    try {
      return new URL(to, from).href
    } catch {
      return to
    }
  }

  // 4) base 只是路径（如 /models/default/model3.json），按 Node url.resolve 的习惯拼接目录
  const fromClean = stripQueryHash(from)
  const baseDir = fromClean.endsWith('/') ? fromClean : fromClean.slice(0, fromClean.lastIndexOf('/') + 1)
  const joined = baseDir + to
  return normalizePath(joined)
}

export function format(urlObj: string | LegacyParsedUrl): string {
  if (typeof urlObj === 'string') return urlObj
  if (!urlObj || typeof urlObj !== 'object') return ''

  if (urlObj.href) return urlObj.href

  const protocol = urlObj.protocol ?? ''
  const slashes = urlObj.slashes ?? Boolean(protocol)
  const slashesPart = slashes ? '//' : ''
  const authPart = urlObj.auth ? `${urlObj.auth}@` : ''

  const host =
    urlObj.host ??
    (urlObj.hostname ? `${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}` : '')

  const pathname = urlObj.pathname ?? ''
  const search = urlObj.search ?? ''
  const hash = urlObj.hash ?? ''

  return `${protocol}${slashesPart}${authPart}${host}${pathname}${search}${hash}`
}

const url = { parse, format, resolve }
export default url

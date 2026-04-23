import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const htmlFiles = [
  'main.html',
  'settings.html',
  'welcome.html',
] as const

function readHtml(fileName: string): string {
  return fs.readFileSync(path.join(process.cwd(), fileName), 'utf8')
}

function readCspDirectives(fileName: string): Map<string, string[]> {
  const html = readHtml(fileName)
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)
  if (!match) {
    throw new Error(`${fileName} 缺少 Content-Security-Policy meta 标签`)
  }

  const directives = new Map<string, string[]>()
  for (const directive of match[1].split(';').map((item) => item.trim()).filter(Boolean)) {
    const [name, ...sources] = directive.split(/\s+/)
    directives.set(name, sources)
  }

  return directives
}

describe('htmlCsp', () => {
  it('allows astrbot-model protocol for connect img and media sources', () => {
    for (const fileName of htmlFiles) {
      const directives = readCspDirectives(fileName)
      expect(directives.get('img-src')).toContain('astrbot-model:')
      expect(directives.get('connect-src')).toContain('astrbot-model:')
      expect(directives.get('media-src')).toContain('astrbot-model:')
    }
  })
})

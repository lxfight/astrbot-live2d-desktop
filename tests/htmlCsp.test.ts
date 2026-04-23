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

describe('htmlCsp', () => {
  it('allows astrbot-model protocol for connect img and media sources', () => {
    for (const fileName of htmlFiles) {
      const html = readHtml(fileName)
      expect(html).toContain("img-src 'self' data: http: https: blob: file: history-resource: astrbot-model:")
      expect(html).toContain("connect-src 'self' http: https: ws: wss: file: history-resource: astrbot-model:")
      expect(html).toContain("media-src 'self' data: http: https: blob: file: history-resource: astrbot-model:")
    }
  })
})

import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

let configured = false

const MARKDOWN_ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'ul',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'mspace', 'msup', 'msub', 'annotation', 'annotation-xml',
]

const MARKDOWN_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'aria-hidden', 'xmlns', 'encoding',
]

export function configureMarked(): void {
  if (configured) return
  configured = true

  marked.setOptions({
    breaks: true,
    gfm: true,
  })

  marked.use({
    extensions: [
      {
        name: 'latex-inline',
        level: 'inline',
        start(src: string) { return src.indexOf('$') },
        tokenizer(src: string) {
          const match = src.match(/^\$([^\$]+)\$/)
          if (match) {
            return { type: 'latex-inline', raw: match[0], text: match[1] }
          }
        },
        renderer(token: any) {
          try {
            return katex.renderToString(token.text, { throwOnError: false })
          } catch {
            return token.raw
          }
        },
      },
      {
        name: 'latex-block',
        level: 'block',
        start(src: string) { return src.indexOf('$$') },
        tokenizer(src: string) {
          const match = src.match(/^\$\$([^\$]+)\$\$/)
          if (match) {
            return { type: 'latex-block', raw: match[0], text: match[1] }
          }
        },
        renderer(token: any) {
          try {
            return katex.renderToString(token.text, { displayMode: true, throwOnError: false })
          } catch {
            return token.raw
          }
        },
      },
    ],
  })
}

export function renderBubbleMarkdown(text: string): string {
  if (!text) return ''
  try {
    const renderedHtml = marked.parse(text) as string
    return DOMPurify.sanitize(renderedHtml, {
      ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
      ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    })
  } catch (error) {
    console.error('[Markdown] 渲染失败:', error)
    return text
  }
}

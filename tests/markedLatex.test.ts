/**
 * markedLatex 测试
 * 覆盖 markdown 渲染、LaTeX 行内/块级扩展、HTML 净化与失败回退
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { marked } from 'marked'

const sanitizeSpy = vi.hoisted(() =>
  vi.fn((html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ''))
)

vi.mock('dompurify', () => ({
  default: {
    sanitize: sanitizeSpy
  }
}))

vi.mock('katex', () => ({
  default: {
    renderToString: vi.fn(
      (text: string, options: { displayMode?: boolean }) =>
        `<span data-katex="${options.displayMode ? 'block' : 'inline'}">${text}</span>`
    )
  }
}))

const { configureMarked, renderBubbleMarkdown } = await import('../src/utils/markedLatex')

beforeEach(() => {
  configureMarked()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('renderBubbleMarkdown', () => {
  test('空文本返回空字符串', () => {
    expect(renderBubbleMarkdown('')).toBe('')
  })

  test('渲染基础 markdown 并通过 DOMPurify 净化', () => {
    const html = renderBubbleMarkdown('**加粗** 和 *斜体*')

    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(sanitizeSpy).toHaveBeenCalledOnce()
    expect(sanitizeSpy.mock.calls[0][1].ALLOWED_TAGS).toContain('strong')
    expect(sanitizeSpy.mock.calls[0][1].ALLOW_DATA_ATTR).toBe(false)
  })

  test('净化阶段移除 script 标签', () => {
    const html = renderBubbleMarkdown('<script>alert(1)</script>hello')

    expect(html).not.toContain('script')
    expect(html).toContain('hello')
  })

  test('渲染行内 LaTeX 公式', () => {
    const html = renderBubbleMarkdown('公式 $x^2$ 结束')

    expect(html).toContain('data-katex="inline"')
    expect(html).toContain('x^2')
  })

  test('渲染块级 LaTeX 公式', () => {
    const html = renderBubbleMarkdown('$$x^2$$')

    expect(html).toContain('data-katex="block"')
  })

  test('渲染失败时回退到原文', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(marked, 'parse').mockImplementationOnce(() => {
      throw new Error('parse failed')
    })

    const text = '原始文本'
    expect(renderBubbleMarkdown(text)).toBe(text)
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})

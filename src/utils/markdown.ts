import { marked } from 'marked'
import katex from 'katex'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'

// 注册常用语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)

// 配置 marked 支持代码高亮
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

// LaTeX 渲染函数
export const renderLatex = (html: string): string => {
  // 块级公式: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch (e) {
      console.error('[LaTeX] 渲染失败:', e)
      return `$$${tex}$$`
    }
  })

  // 行内公式: $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch (e) {
      console.error('[LaTeX] 渲染失败:', e)
      return `$${tex}$`
    }
  })

  return html
}

// Markdown + LaTeX 渲染函数
export const renderMarkdownWithLatex = (text: string): string => {
  try {
    // 先解析 Markdown
    let html = marked.parse(text) as string
    // 再处理 LaTeX
    html = renderLatex(html)
    return html
  } catch (e) {
    console.error('[Markdown] 渲染失败:', e)
    return text
  }
}

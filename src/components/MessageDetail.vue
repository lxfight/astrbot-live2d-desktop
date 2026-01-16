<template>
  <div class="message-detail">
    <div class="header">
      <h2>消息详情</h2>
      <button class="close-btn" @click="close">✕</button>
    </div>
    <div class="content" v-html="renderedContent"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import type { Tokens } from 'marked'
import katex from 'katex'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import type { TextPerformItem } from '@/types/websocket'

// 引入样式
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

// 注册常用语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)

// 配置 marked 支持代码高亮
const renderer = new marked.Renderer()
renderer.code = ({ text, lang }: Tokens.Code) => {
  const language = lang && hljs.getLanguage(lang) ? lang : undefined
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : hljs.highlightAuto(text).value
  const className = language ? `hljs language-${language}` : 'hljs'
  return `<pre><code class="${className}">${highlighted}</code></pre>`
}

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true
})

// LaTeX 渲染函数
const renderLatex = (html: string): string => {
  // 块级公式: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch (e) {
      console.error('[消息详情] LaTeX 渲染失败:', e)
      return `$$${tex}$$`
    }
  })

  // 行内公式: $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch (e) {
      console.error('[消息详情] LaTeX 渲染失败:', e)
      return `$${tex}$`
    }
  })

  return html
}

const renderedContent = ref('')

onMounted(async () => {
  try {
    // 从主进程获取消息数据
    if (window.electronAPI?.getMessageDetailData) {
      const data = await window.electronAPI.getMessageDetailData()

      if (data) {
        // 提取文本内容
        let textContent = ''

        if (Array.isArray(data)) {
          // 如果是消息序列数组
          const textItem = data.find(
            (item): item is TextPerformItem => item?.type === 'text'
          )
          if (textItem?.content) {
            textContent = String(textItem.content)
          }
        } else if (typeof data === 'string') {
          // 如果直接是字符串
          textContent = data
        } else if (data.content) {
          // 如果是对象且有 content 属性
          textContent = String(data.content)
        }

        if (textContent) {
          // 渲染 Markdown 和 LaTeX
          let html = marked.parse(textContent) as string
          html = renderLatex(html)
          renderedContent.value = html
        } else {
          renderedContent.value = '<p>无消息内容</p>'
        }
      } else {
        renderedContent.value = '<p>无消息内容</p>'
      }
    } else {
      renderedContent.value = '<p>无法获取消息数据</p>'
    }
  } catch (error) {
    console.error('[消息详情] 加载失败:', error)
    renderedContent.value = '<p>加载消息失败</p>'
  }
})

const close = () => {
  if (window.electronAPI?.closeMessageDetail) {
    window.electronAPI.closeMessageDetail()
  } else {
    window.close()
  }
}
</script>

<style scoped>
.message-detail {
  width: 100%;
  height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  color: #333;
  line-height: 1.8;
}

/* Markdown 样式 */
.content :deep(h1),
.content :deep(h2),
.content :deep(h3),
.content :deep(h4),
.content :deep(h5),
.content :deep(h6) {
  margin: 24px 0 12px 0;
  font-weight: bold;
  line-height: 1.4;
}

.content :deep(h1) { font-size: 2em; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
.content :deep(h2) { font-size: 1.6em; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
.content :deep(h3) { font-size: 1.3em; }
.content :deep(h4) { font-size: 1.1em; }

.content :deep(p) {
  margin: 12px 0;
}

.content :deep(ul),
.content :deep(ol) {
  margin: 12px 0;
  padding-left: 32px;
}

.content :deep(li) {
  margin: 6px 0;
}

.content :deep(a) {
  color: #0066cc;
  text-decoration: none;
}

.content :deep(a:hover) {
  text-decoration: underline;
}

.content :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #d63384;
}

.content :deep(pre) {
  background: #1e1e1e;
  color: #f8f8f2;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
  line-height: 1.5;
}

.content :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
  font-size: 14px;
}

.content :deep(blockquote) {
  border-left: 4px solid #0066cc;
  padding-left: 16px;
  margin: 16px 0;
  color: #666;
  font-style: italic;
}

.content :deep(table) {
  border-collapse: collapse;
  margin: 16px 0;
  width: 100%;
  border: 1px solid #e0e0e0;
}

.content :deep(th),
.content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 8px 12px;
  text-align: left;
}

.content :deep(th) {
  background: #f5f5f5;
  font-weight: bold;
}

.content :deep(tr:nth-child(even)) {
  background: #fafafa;
}

.content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
}

.content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 24px 0;
}

/* LaTeX 公式样式 */
.content :deep(.katex-display) {
  margin: 16px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.content :deep(.katex) {
  font-size: 1.1em;
}

/* 滚动条样式 */
.content::-webkit-scrollbar {
  width: 8px;
}

.content::-webkit-scrollbar-track {
  background: #f5f5f5;
}

.content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.content::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>

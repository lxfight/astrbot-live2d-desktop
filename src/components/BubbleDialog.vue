<template>
  <div
    class="bubble-dialog"
    :style="bubbleStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
  >
    <div class="bubble-content">
      <div v-if="text" class="bubble-text" v-html="renderedContent"></div>
      <img v-if="imageUrl" :src="imageUrl" class="bubble-image" @error="onImageError" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { marked } from 'marked'
import type { Tokens } from 'marked'
import katex from 'katex'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'

// 引入样式
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

// 注册常用语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)

const props = defineProps<{
  text?: string
  imageUrl?: string
  x?: number
  y?: number
  duration?: number
  fullContent?: any
}>()

const emit = defineEmits<{
  hover: [isHovered: boolean]
  click: []
}>()

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
      console.error('[气泡] LaTeX 渲染失败:', e)
      return `$$${tex}$$`
    }
  })

  // 行内公式: $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch (e) {
      console.error('[气泡] LaTeX 渲染失败:', e)
      return `$${tex}$`
    }
  })

  return html
}

// 渲染内容
const renderedContent = ref('')

watchEffect(() => {
  if (props.text) {
    try {
      // 先解析 Markdown
      let html = marked.parse(props.text) as string
      // 再处理 LaTeX
      html = renderLatex(html)
      renderedContent.value = html
    } catch (e) {
      console.error('[气泡] 渲染失败:', e)
      renderedContent.value = props.text
    }
  }
})

const onImageError = () => {
  console.error('[气泡] 图片加载失败:', props.imageUrl)
}

const bubbleStyle = computed(() => {
  if (typeof props.x === 'number' && typeof props.y === 'number') {
    return {
      position: 'fixed',
      left: `${props.x}px`,
      top: `${props.y}px`,
      transform: 'translate(-50%, -100%)'
    } as const
  }

  return {}
})

// 鼠标事件处理
const handleMouseEnter = () => {
  emit('hover', true)
}

const handleMouseLeave = () => {
  emit('hover', false)
}

const handleClick = () => {
  if (props.fullContent) {
    emit('click')
  }
}
</script>

<style scoped>
.bubble-dialog {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 400px;
  z-index: 100;
  pointer-events: auto;
}

.bubble-content {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  padding: 12px 20px;
  border-radius: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
  max-height: 10vh;
  overflow-y: auto;
  cursor: pointer;
  transition: background 0.2s;
  pointer-events: auto;
}

.bubble-content:hover {
  background: rgba(255, 255, 255, 1);
}

.bubble-text {
  margin-bottom: 0;
}

/* Markdown 样式 */
.bubble-text :deep(h1),
.bubble-text :deep(h2),
.bubble-text :deep(h3),
.bubble-text :deep(h4),
.bubble-text :deep(h5),
.bubble-text :deep(h6) {
  margin: 8px 0 4px 0;
  font-weight: bold;
}

.bubble-text :deep(h1) { font-size: 1.5em; }
.bubble-text :deep(h2) { font-size: 1.3em; }
.bubble-text :deep(h3) { font-size: 1.1em; }

.bubble-text :deep(p) {
  margin: 4px 0;
}

.bubble-text :deep(ul),
.bubble-text :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.bubble-text :deep(li) {
  margin: 2px 0;
}

.bubble-text :deep(a) {
  color: #0066cc;
  text-decoration: none;
}

.bubble-text :deep(a:hover) {
  text-decoration: underline;
}

.bubble-text :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.bubble-text :deep(pre) {
  background: rgba(0, 0, 0, 0.8);
  color: #f8f8f2;
  padding: 8px 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.bubble-text :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.bubble-text :deep(blockquote) {
  border-left: 3px solid #ccc;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
}

.bubble-text :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}

.bubble-text :deep(th),
.bubble-text :deep(td) {
  border: 1px solid #ddd;
  padding: 4px 8px;
  text-align: left;
}

.bubble-text :deep(th) {
  background: rgba(0, 0, 0, 0.05);
  font-weight: bold;
}

/* LaTeX 公式样式 */
.bubble-text :deep(.katex-display) {
  margin: 8px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.bubble-text :deep(.katex) {
  font-size: 1em;
}

/* 滚动条样式 */
.bubble-content::-webkit-scrollbar {
  width: 6px;
}

.bubble-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.bubble-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.bubble-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.bubble-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: 10px;
  margin-top: 8px;
  display: block;
}

.bubble-content::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(255, 255, 255, 0.95);
}
</style>

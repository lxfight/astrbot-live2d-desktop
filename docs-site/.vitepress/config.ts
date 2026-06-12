import { defineConfig } from 'vitepress'

const repo = 'https://github.com/lxfight/astrbot-live2d-desktop'

const zhNav = [
  { text: '指南', link: '/guide/getting-started' },
  { text: '协议', link: '/protocol/overview' },
  { text: '模型配置', link: '/model-config/overview' },
  { text: '发布', link: '/release/compatibility' }
]

const enNav = [
  { text: 'Guide', link: '/en/guide/getting-started' },
  { text: 'Protocol', link: '/en/protocol/overview' },
  { text: 'Model Config', link: '/en/model-config/overview' },
  { text: 'Release', link: '/en/release/compatibility' }
]

const zhSidebar = [
  {
    text: '指南',
    items: [
      { text: '总览', link: '/' },
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '架构', link: '/guide/architecture' }
    ]
  },
  {
    text: '协议',
    items: [
      { text: '协议总览', link: '/protocol/overview' },
      { text: 'State Model v2', link: '/protocol/state-model-v2' },
      { text: 'Perform Show', link: '/protocol/perform-show' }
    ]
  },
  {
    text: '模型配置',
    items: [{ text: '别名配置', link: '/model-config/overview' }]
  },
  {
    text: '发布',
    items: [{ text: '兼容性', link: '/release/compatibility' }]
  }
]

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Overview', link: '/en/' },
      { text: 'Getting Started', link: '/en/guide/getting-started' },
      { text: 'Architecture', link: '/en/guide/architecture' }
    ]
  },
  {
    text: 'Protocol',
    items: [
      { text: 'Overview', link: '/en/protocol/overview' },
      { text: 'State Model v2', link: '/en/protocol/state-model-v2' },
      { text: 'Perform Show', link: '/en/protocol/perform-show' }
    ]
  },
  {
    text: 'Model Config',
    items: [{ text: 'Aliases', link: '/en/model-config/overview' }]
  },
  {
    text: 'Release',
    items: [{ text: 'Compatibility', link: '/en/release/compatibility' }]
  }
]

export default defineConfig({
  title: 'AstrBot Live2D Desktop',
  description: 'AstrBot Live2D 桌面端、适配器与桥接协议文档。',
  lang: 'zh-CN',
  base: process.env.VITEPRESS_BASE ?? '/',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: zhNav,
    sidebar: zhSidebar,
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除查询',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          }
        }
      }
    },
    footer: {
      message: '面向 AstrBot Live2D 桥接用户与插件开发者构建。',
      copyright: 'MIT Licensed'
    },
    outline: { label: '本页目录' },
    darkModeSwitchLabel: '外观',
    darkModeSwitchTitle: '切换到深色主题',
    lightModeSwitchTitle: '切换到浅色主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '返回顶部',
    langMenuLabel: '切换语言',
    skipToContentLabel: '跳到内容',
    docFooter: {
      prev: '上一页',
      next: '下一页'
    }
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/'
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'Desktop client, AstrBot adapter, and L2D bridge protocol documentation.',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        footer: {
          message: 'Built for AstrBot Live2D bridge users and plugin developers.',
          copyright: 'MIT Licensed'
        },
        outline: { label: 'On this page' },
        darkModeSwitchLabel: 'Appearance',
        darkModeSwitchTitle: 'Switch to dark theme',
        lightModeSwitchTitle: 'Switch to light theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        skipToContentLabel: 'Skip to content',
        docFooter: {
          prev: 'Previous page',
          next: 'Next page'
        }
      }
    }
  }
})

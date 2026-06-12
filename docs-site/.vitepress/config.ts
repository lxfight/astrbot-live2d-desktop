import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AstrBot Live2D Desktop',
  description: 'Desktop client, AstrBot adapter, and L2D bridge protocol documentation.',
  base: '/',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Protocol', link: '/protocol/overview' },
      { text: 'Model Config', link: '/model-config/overview' },
      { text: 'Release', link: '/release/compatibility' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Architecture', link: '/guide/architecture' }
        ]
      },
      {
        text: 'Protocol',
        items: [
          { text: 'Overview', link: '/protocol/overview' },
          { text: 'State Model v2', link: '/protocol/state-model-v2' },
          { text: 'Perform Show', link: '/protocol/perform-show' }
        ]
      },
      {
        text: 'Model Config',
        items: [{ text: 'Aliases', link: '/model-config/overview' }]
      },
      {
        text: 'Release',
        items: [{ text: 'Compatibility', link: '/release/compatibility' }]
      }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/lxfight/astrbot-live2d-desktop' }],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'Built for AstrBot Live2D bridge users and plugin developers.',
      copyright: 'MIT Licensed'
    }
  }
})

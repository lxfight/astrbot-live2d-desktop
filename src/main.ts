import * as PIXI from 'pixi.js'

// 立即修补 PIXI - 必须在导入任何其他模块之前
;(window as any).PIXI = PIXI

// 添加缺失的 BLEND_MODES 常量（pixi-live2d-display 需要）
if (!PIXI.BLEND_MODES.SRC_TO_X) {
  console.log('[AstrBot-L2D] 添加 BLEND_MODES.SRC_TO_X')
  ;(PIXI.BLEND_MODES as any).SRC_TO_X = PIXI.BLEND_MODES.SRC_OVER
}

console.log('[AstrBot-L2D] PixiJS 版本:', PIXI.VERSION)
console.log('[AstrBot-L2D] PIXI.BLEND_MODES.SRC_TO_X:', (PIXI.BLEND_MODES as any).SRC_TO_X)

// 现在才导入其他模块
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import AppDesktop from './App.desktop.vue'
import Settings from './components/SettingsNew.vue'
import MessageDetail from './components/MessageDetail.vue'

// 等待 Cubism SDK 加载完成后再初始化应用
async function initApp() {
  // 等待 Cubism SDK
  while (!(window as any).Live2DCubismCore) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log('[AstrBot-L2D] Cubism SDK 已加载，初始化应用...')

  // 创建 Cubism 2 兼容层（如果不存在）
  if (!(window as any).Live2D) {
    console.log('[AstrBot-L2D] 创建 Cubism 2 兼容层')
    ;(window as any).Live2D = {
      __compatibility_layer: true,
      VERSION_MAJOR: 2,
      VERSION_MINOR: 1,
      VERSION_PATCH: 0
    }
  }

  // 动态导入 pixi-live2d-display
  console.log('[AstrBot-L2D] 准备导入 pixi-live2d-display...')
  const { Live2DModel } = await import('pixi-live2d-display')

  // 注册 Ticker
  Live2DModel.registerTicker(PIXI.Ticker)
  console.log('[AstrBot-L2D] Live2D Model 已注册')

  // 根据 URL hash 判断加载哪个组件
  const hash = window.location.hash

  let AppComponent
  if (hash === '#settings' || hash === '#/settings') {
    AppComponent = Settings
    console.log('[AstrBot-L2D] 加载设置界面')
  } else if (hash === '#message-detail' || hash === '#/message-detail') {
    AppComponent = MessageDetail
    console.log('[AstrBot-L2D] 加载消息详情窗口')
  } else {
    AppComponent = AppDesktop
    console.log('[AstrBot-L2D] 加载主应用')
  }

  const pinia = createPinia()
  const app = createApp(AppComponent)

  app.use(pinia)
  app.mount('#app')
}

// 启动应用
initApp().catch(err => {
  console.error('[AstrBot-L2D] 初始化失败:', err)
  console.error('[AstrBot-L2D] 错误堆栈:', err.stack)
})

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import naive from 'naive-ui'
import App from './App.vue'
import { setupRendererLogging } from './utils/rendererLogger'
import './styles/global.scss'

setupRendererLogging()

const CUBISM_CORE_SCRIPT_ID = 'cubism-core-runtime'
const CUBISM_CORE_SCRIPT_SRC = 'cubism://core/live2dcubismcore.min.js'

async function ensureCubismCoreLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof Live2DCubismCore !== 'undefined') {
    return
  }

  const existingScript = document.getElementById(CUBISM_CORE_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    await waitForScriptLoad(existingScript)
    return
  }

  const script = document.createElement('script')
  script.id = CUBISM_CORE_SCRIPT_ID
  script.src = CUBISM_CORE_SCRIPT_SRC
  script.async = false

  const loadPromise = waitForScriptLoad(script)
  document.head.appendChild(script)
  await loadPromise
}

function waitForScriptLoad(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (script.dataset.loaded === 'true') {
      resolve()
      return
    }

    const cleanup = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      script.dataset.loaded = 'true'
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      reject(new Error(`Cubism Core 加载失败: ${CUBISM_CORE_SCRIPT_SRC}`))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
  })
}

// 创建路由
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main' },
    { path: '/main', component: () => import('./windows/Main.vue') },
    { path: '/settings', component: () => import('./windows/Settings.vue') },
    { path: '/history', component: () => import('./windows/History.vue') },
    { path: '/welcome', component: () => import('./windows/Welcome.vue') }
  ]
})

async function bootstrap() {
  await ensureCubismCoreLoaded()

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)
  app.use(naive)

  app.mount('#app')
}

void bootstrap()

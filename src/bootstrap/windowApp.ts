import { createApp, defineComponent, h, markRaw, onBeforeUnmount, onMounted, type Component, watch } from 'vue'
import { createPinia, storeToRefs } from 'pinia'
import naive, { NConfigProvider, NDialogProvider, NMessageProvider, darkTheme } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'
import { setupRendererLogging } from '@/utils/rendererLogger'
import { applyWindowKindClasses, type WindowKind } from '@/utils/windowKind'
import '@/styles/global.scss'

const CUBISM_CORE_SCRIPT_ID = 'cubism-core-runtime'
const CUBISM_CORE_SCRIPT_SRC = 'cubism://core/live2dcubismcore.min.js'

function applyThemeCssVars(vars: Record<string, string>): void {
  if (typeof document === 'undefined') {
    return
  }

  const rootStyle = document.documentElement.style
  for (const [key, value] of Object.entries(vars)) {
    if (rootStyle.getPropertyValue(key) !== value) {
      rootStyle.setProperty(key, value)
    }
  }
}

function createWindowRoot(component: Component) {
  const targetComponent = markRaw(component)

  return defineComponent({
    name: 'WindowAppRoot',
    setup() {
      const themeStore = useThemeStore()
      const { cssVars, naiveThemeOverrides } = storeToRefs(themeStore)

      onMounted(() => {
        themeStore.syncFromStorage()
        themeStore.startStorageSync()
      })

      onBeforeUnmount(() => {
        themeStore.stopStorageSync()
      })

      watch(cssVars, (vars) => {
        applyThemeCssVars(vars)
      }, { immediate: true })

      return () => h(
        NConfigProvider,
        {
          theme: darkTheme,
          themeOverrides: naiveThemeOverrides.value,
        },
        {
          default: () => h(
            NMessageProvider,
            null,
            {
              default: () => h(
                NDialogProvider,
                null,
                {
                  default: () => h(
                    'div',
                    {
                      class: 'window-app-root',
                      style: {
                        width: '100%',
                        height: '100%',
                      },
                    },
                    [h(targetComponent)],
                  ),
                },
              ),
            },
          ),
        },
      )
    },
  })
}

function waitForScriptLoad(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptReadyState = (script as HTMLScriptElement & { readyState?: string }).readyState

    if (script.dataset.loaded === 'true' || typeof Live2DCubismCore !== 'undefined') {
      script.dataset.loaded = 'true'
      resolve()
      return
    }

    if (scriptReadyState === 'complete' || scriptReadyState === 'loaded') {
      script.dataset.loaded = 'true'
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

export async function ensureCubismCoreLoaded(): Promise<void> {
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

export interface MountWindowAppOptions {
  component: Component
  windowKind: WindowKind
  beforeMount?: () => Promise<void> | void
  mountSelector?: string
}

export async function mountWindowApp(options: MountWindowAppOptions): Promise<void> {
  const {
    component,
    windowKind,
    beforeMount,
    mountSelector = '#app',
  } = options

  setupRendererLogging()
  applyWindowKindClasses(windowKind)

  if (beforeMount) {
    await beforeMount()
  }

  const app = createApp(createWindowRoot(component))

  app.use(createPinia())
  app.use(naive)
  app.mount(mountSelector)
}

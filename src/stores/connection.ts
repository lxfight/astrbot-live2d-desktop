import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const DEFAULT_SERVER_URL = 'ws://127.0.0.1:9090/astrbot/live2d'
const DEFAULT_RESOURCE_PATH = '/resources'
const CONNECTION_SETTINGS_KEY = 'connectionSettings'

type ConnectionSettings = {
  serverUrl: string
  token: string
  resourceBaseUrl: string
  resourcePath: string
  resourceOverrideBaseUrl: string
  resourceOverridePath: string
  resourceToken: string
}

function getDefaultConnectionSettings(): ConnectionSettings {
  return {
    serverUrl: DEFAULT_SERVER_URL,
    token: '',
    resourceBaseUrl: '',
    resourcePath: DEFAULT_RESOURCE_PATH,
    resourceOverrideBaseUrl: '',
    resourceOverridePath: '',
    resourceToken: '',
  }
}

function loadConnectionSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(CONNECTION_SETTINGS_KEY)
    if (!raw) {
      return getDefaultConnectionSettings()
    }

    const parsed = JSON.parse(raw) as {
      serverUrl?: unknown
      token?: unknown
      resourceBaseUrl?: unknown
      resourcePath?: unknown
      resourceOverrideBaseUrl?: unknown
      resourceOverridePath?: unknown
      resourceToken?: unknown
    }
    const defaults = getDefaultConnectionSettings()

    return {
      serverUrl: typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim()
        ? parsed.serverUrl.trim()
        : defaults.serverUrl,
      token: typeof parsed.token === 'string'
        ? parsed.token.trim()
        : defaults.token,
      resourceBaseUrl: typeof parsed.resourceBaseUrl === 'string'
        ? parsed.resourceBaseUrl.trim()
        : defaults.resourceBaseUrl,
      resourcePath: typeof parsed.resourcePath === 'string' && parsed.resourcePath.trim()
        ? parsed.resourcePath.trim()
        : defaults.resourcePath,
      resourceOverrideBaseUrl: typeof parsed.resourceOverrideBaseUrl === 'string'
        ? parsed.resourceOverrideBaseUrl.trim()
        : defaults.resourceOverrideBaseUrl,
      resourceOverridePath: typeof parsed.resourceOverridePath === 'string'
        ? parsed.resourceOverridePath.trim()
        : defaults.resourceOverridePath,
      resourceToken: typeof parsed.resourceToken === 'string'
        ? parsed.resourceToken.trim()
        : defaults.resourceToken,
    }
  } catch (error) {
    console.warn('[ConnectionStore] ??????????????:', error)
    return getDefaultConnectionSettings()
  }
}

function saveConnectionSettings(settings: ConnectionSettings) {
  try {
    localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('[ConnectionStore] ????????:', error)
  }
}

export const useConnectionStore = defineStore('connection', () => {
  const initialSettings = loadConnectionSettings()
  const isConnected = ref(false)
  const sessionId = ref('')
  const userId = ref('')
  const sessionResourceBaseUrl = ref(initialSettings.resourceBaseUrl)
  const sessionResourcePath = ref(initialSettings.resourcePath)
  const maxInlineBytes = ref<number | null>(null)
  const serverUrl = ref(initialSettings.serverUrl)
  const token = ref(initialSettings.token)
  const customResourceBaseUrl = ref(initialSettings.resourceOverrideBaseUrl)
  const customResourcePath = ref(initialSettings.resourceOverridePath)
  const customResourceToken = ref(initialSettings.resourceToken)

  const resourceBaseUrl = computed(() => {
    const overrideValue = customResourceBaseUrl.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    return sessionResourceBaseUrl.value.trim()
  })

  const resourcePath = computed(() => {
    const overrideValue = customResourcePath.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    const sessionValue = sessionResourcePath.value.trim()
    return sessionValue || DEFAULT_RESOURCE_PATH
  })

  const resourceToken = computed(() => {
    const overrideValue = customResourceToken.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    return token.value.trim()
  })

  function persistSettings() {
    saveConnectionSettings({
      serverUrl: serverUrl.value,
      token: token.value,
      resourceBaseUrl: sessionResourceBaseUrl.value,
      resourcePath: sessionResourcePath.value,
      resourceOverrideBaseUrl: customResourceBaseUrl.value,
      resourceOverridePath: customResourcePath.value,
      resourceToken: customResourceToken.value,
    })
  }

  function applyPersistedSettings(settings: ConnectionSettings) {
    serverUrl.value = settings.serverUrl
    token.value = settings.token
    sessionResourceBaseUrl.value = settings.resourceBaseUrl
    sessionResourcePath.value = settings.resourcePath
    customResourceBaseUrl.value = settings.resourceOverrideBaseUrl
    customResourcePath.value = settings.resourceOverridePath
    customResourceToken.value = settings.resourceToken
  }

  function reloadPersistedSettings() {
    applyPersistedSettings(loadConnectionSettings())
  }

  function applySessionState(session: BridgeSessionState | null | undefined) {
    sessionId.value = session?.sessionId || ''
    userId.value = session?.userId || ''
    if (session?.config?.resourceBaseUrl) {
      sessionResourceBaseUrl.value = session.config.resourceBaseUrl
    }
    if (session?.config?.resourcePath) {
      sessionResourcePath.value = session.config.resourcePath
    }
    maxInlineBytes.value = typeof session?.config?.maxInlineBytes === 'number'
      ? session.config.maxInlineBytes
      : null
    persistSettings()
  }

  function resetSessionState() {
    isConnected.value = false
    sessionId.value = ''
    userId.value = ''
    maxInlineBytes.value = null
  }

  function setConnectionConfig(url: string, authToken: string) {
    serverUrl.value = (url || '').trim() || DEFAULT_SERVER_URL
    token.value = (authToken || '').trim()
    persistSettings()
  }

  function setResourceConfig(baseUrl: string, path: string, accessToken: string) {
    customResourceBaseUrl.value = (baseUrl || '').trim()
    customResourcePath.value = (path || '').trim()
    customResourceToken.value = (accessToken || '').trim()
    persistSettings()
  }

  async function connect(url?: string, authToken?: string) {
    try {
      const targetUrl = (url || serverUrl.value || '').trim()
      const normalizedToken = (authToken ?? token.value ?? '').trim()

      if (!targetUrl) {
        return { success: false, error: '?????????' }
      }
      if (!/^wss?:\/\//i.test(targetUrl)) {
        return { success: false, error: '???????? ws:// ? wss:// ??' }
      }
      if (!normalizedToken) {
        return { success: false, error: '????????????????????' }
      }
      if (normalizedToken.length < 16) {
        return { success: false, error: '???????? 16 ?' }
      }

      setConnectionConfig(targetUrl, normalizedToken)
      const result = await window.electron.bridge.connect(targetUrl, normalizedToken)

      if (result.success) {
        isConnected.value = true
        const session = await window.electron.bridge.getSession()
        applySessionState(session)
        return { success: true }
      }

      return { success: false, error: result.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async function disconnect() {
    try {
      await window.electron.bridge.disconnect()
      resetSessionState()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async function checkConnection() {
    reloadPersistedSettings()
    const connected = await window.electron.bridge.isConnected()
    isConnected.value = connected

    if (connected) {
      const session = await window.electron.bridge.getSession()
      applySessionState(session)
    } else {
      applySessionState(null)
    }

    return connected
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key !== null && event.key !== CONNECTION_SETTINGS_KEY) {
        return
      }
      reloadPersistedSettings()
    })
  }

  async function sendMessage(content: any[], metadata: any) {
    return await window.electron.bridge.sendMessage({ content, metadata })
  }

  async function sendState(op: string, payload: any) {
    return await window.electron.bridge.sendState(op, payload)
  }

  return {
    isConnected,
    sessionId,
    userId,
    resourceBaseUrl,
    resourcePath,
    resourceToken,
    maxInlineBytes,
    serverUrl,
    token,
    customResourceBaseUrl,
    customResourcePath,
    customResourceToken,
    applySessionState,
    resetSessionState,
    setConnectionConfig,
    setResourceConfig,
    reloadPersistedSettings,
    connect,
    disconnect,
    checkConnection,
    sendMessage,
    sendState,
  }
})

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORCUPINE_ACCESS_KEY?: string
  readonly VITE_PORCUPINE_MODULE_PATH?: string
  readonly VITE_PORCUPINE_MODEL_PATH?: string
  readonly VITE_PORCUPINE_KEYWORD_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

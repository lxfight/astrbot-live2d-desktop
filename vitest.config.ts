import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
      '@cubism-framework': resolve(__dirname, '.generated/cubism-framework/src')
    }
  },
  server: {
    host: '127.0.0.1'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'electron/protocol/**/*.ts',
        'electron/database/**/*.ts',
        'electron/ipc/**/*.ts',
        'electron/utils/windowWatcher.ts',
        'src/stores/**/*.ts',
        'src/windows/composables/**/*.ts',
        'src/utils/**/*.ts'
      ]
    }
  }
})

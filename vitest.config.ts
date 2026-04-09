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
        'electron/protocol/messageContent.ts',
        'electron/database/messageDirection.ts',
        'electron/database/messageSearch.ts',
        'electron/database/nativeBinding.ts',
        'src/utils/advancedSettings.ts'
      ]
    }
  }
})

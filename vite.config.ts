import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              // ws 不可列入 external：打包产物必须自包含，否则在缺少 node_modules/ws 的安装/便携形态下会导致主进程启动失败
              external: ['electron', 'better-sqlite3'],
              output: {
                format: 'es'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              output: {
                format: 'cjs'
              }
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
      '@cubism-framework': resolve(__dirname, '.generated/cubism-framework/src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'naive-ui': ['naive-ui'],
          'echarts': ['echarts'],
          'vendor': ['vue', 'pinia', 'vue-router']
        }
      }
    }
  }
})

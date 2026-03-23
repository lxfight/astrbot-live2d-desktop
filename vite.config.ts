import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    {
      name: 'preserve-cubism-core-script',
      enforce: 'pre',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html.replace(
            /<script\s+src="cubism:\/\/core\/live2dcubismcore\.min\.js"\s+data-cubism-core><\/script>/,
            '<script src="cubism://core/live2dcubismcore.min.js"></script>'
          )
        }
      }
    },
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'ws'],
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
      '@electron': resolve(__dirname, 'electron')
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

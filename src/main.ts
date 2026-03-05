import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import naive from 'naive-ui'
import App from './App.vue'
import { setupRendererLogging } from './utils/rendererLogger'
import './styles/global.scss'

setupRendererLogging()

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

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)

app.mount('#app')

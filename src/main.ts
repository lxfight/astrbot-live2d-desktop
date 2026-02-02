import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import naive from 'naive-ui'
import App from './App.vue'
import MainWindow from './windows/Main.vue'
import SettingsWindow from './windows/Settings.vue'
import HistoryWindow from './windows/History.vue'
import './styles/global.scss'

// 创建路由
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main' },
    { path: '/main', component: MainWindow },
    { path: '/settings', component: SettingsWindow },
    { path: '/history', component: HistoryWindow }
  ]
})

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)

app.mount('#app')

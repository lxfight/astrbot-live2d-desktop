import MainWindow from '@/windows/Main.vue'
import { mountWindowApp } from '@/bootstrap/windowApp'

void mountWindowApp({
  component: MainWindow,
  windowKind: 'main'
})

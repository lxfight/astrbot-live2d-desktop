import MainWindow from '@/windows/Main.vue'
import { ensureCubismCoreLoaded, mountWindowApp } from '@/bootstrap/windowApp'

void mountWindowApp({
  component: MainWindow,
  windowKind: 'main',
  beforeMount: ensureCubismCoreLoaded,
})

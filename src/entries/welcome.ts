import WelcomeWindow from '@/windows/Welcome.vue'
import { mountWindowApp } from '@/bootstrap/windowApp'

void mountWindowApp({
  component: WelcomeWindow,
  windowKind: 'welcome',
})

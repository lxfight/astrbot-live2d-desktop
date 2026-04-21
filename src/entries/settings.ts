import SettingsWindow from '@/windows/Settings.vue'
import { mountWindowApp } from '@/bootstrap/windowApp'

void mountWindowApp({
  component: SettingsWindow,
  windowKind: 'settings',
})

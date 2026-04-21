import HistoryWindow from '@/windows/History.vue'
import { mountWindowApp } from '@/bootstrap/windowApp'

void mountWindowApp({
  component: HistoryWindow,
  windowKind: 'history',
})

import { app, type BrowserWindow } from 'electron'
import path from 'path'

export type RendererEntryName = 'main' | 'settings' | 'history' | 'welcome'

const RENDERER_DEV_SERVER_URL = 'http://localhost:5173/'

export function isRendererDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || !app.isPackaged
}

export function loadRendererEntry(window: BrowserWindow, entryName: RendererEntryName): Promise<void> {
  if (isRendererDevMode()) {
    return window.loadURL(new URL(`${entryName}.html`, RENDERER_DEV_SERVER_URL).toString())
  }

  return window.loadFile(path.join(app.getAppPath(), 'dist', `${entryName}.html`))
}

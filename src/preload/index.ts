import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key),
  saveCsv: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-csv', { content, defaultName }),
  savePdfFromCanvas: (dataUrl: string, defaultName: string) =>
    ipcRenderer.invoke('save-pdf-from-canvas', { dataUrl, defaultName }),
  savePng: (dataUrl: string, defaultName: string) =>
    ipcRenderer.invoke('save-png', { dataUrl, defaultName })
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

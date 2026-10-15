import { contextBridge, ipcRenderer } from 'electron'

const api = {
  openListFiles: (): Promise<{ name: string; table: string[][] | null; text: string | null }[]> =>
    ipcRenderer.invoke('files:open'),
  openLogo: (): Promise<string | null> => ipcRenderer.invoke('logo:open'),
  events: {
    list: (): Promise<{ id: string; title: string; createdAt: string; groups: number; drawn: number }[]> =>
      ipcRenderer.invoke('events:list'),
    load: (id: string): Promise<unknown | null> => ipcRenderer.invoke('events:load', id),
    save: (doc: { id: string }): Promise<void> => ipcRenderer.invoke('events:save', doc),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('events:delete', id)
  },
  exportCsv: (name: string, rows: string[][]): Promise<string | null> => ipcRenderer.invoke('export:csv', name, rows),
  exportXlsx: (name: string, sheets: { name: string; rows: string[][] }[]): Promise<string | null> =>
    ipcRenderer.invoke('export:xlsx', name, sheets),
  exportPdf: (name: string, html: string): Promise<string | null> => ipcRenderer.invoke('export:pdf', name, html),
  exportPng: (name: string, html: string): Promise<string | null> => ipcRenderer.invoke('export:png', name, html),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggleFullscreen'),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:isFullscreen'),
  onFullscreen: (cb: (on: boolean) => void): (() => void) => {
    const h = (_e: unknown, on: boolean): void => cb(on)
    ipcRenderer.on('fullscreen', h)
    return () => ipcRenderer.removeListener('fullscreen', h)
  },
  present: {
    open: (data: unknown): Promise<void> => ipcRenderer.invoke('present:open', data),
    get: (): Promise<unknown> => ipcRenderer.invoke('present:get')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

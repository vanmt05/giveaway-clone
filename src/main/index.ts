import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, basename, extname } from 'path'
import { promises as fs } from 'fs'
import ExcelJS from 'exceljs'
import { eventsDir, listEvents, loadEvent, saveEvent, deleteEvent } from './store'

let presentData: unknown = null

function loadRenderer(win: BrowserWindow, hash = ''): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function createWindow(opts: { present?: boolean } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    fullscreen: !!opts.present,
    autoHideMenuBar: true,
    backgroundColor: '#f6f4fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true))
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false))
  loadRenderer(win, opts.present ? 'present' : '')
  return win
}

type ImportedFile = { name: string; table: string[][] | null; text: string | null }

async function readImportFile(path: string): Promise<ImportedFile> {
  const name = basename(path, extname(path))
  if (/\.xlsx$/i.test(path)) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    const ws = wb.worksheets[0]
    const table: string[][] = []
    ws?.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      for (let c = 1; c <= row.cellCount; c++) {
        const v = row.getCell(c).value
        const text =
          v == null ? '' : typeof v === 'object' ? ((v as { text?: string; result?: unknown }).text ?? String((v as { result?: unknown }).result ?? '')) : String(v)
        cells.push(text.trim())
      }
      table.push(cells)
    })
    return { name, table, text: null }
  }
  return { name, table: null, text: await fs.readFile(path, 'utf8') }
}

ipcMain.handle('files:open', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)!
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Listas (xlsx, csv, txt)', extensions: ['xlsx', 'csv', 'txt'] }]
  })
  if (r.canceled) return []
  return Promise.all(r.filePaths.map(readImportFile))
})

ipcMain.handle('logo:open', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)!
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }]
  })
  if (r.canceled) return null
  const p = r.filePaths[0]
  const ext = extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg').replace('svg', 'svg+xml')
  return `data:image/${ext};base64,${(await fs.readFile(p)).toString('base64')}`
})

ipcMain.handle('events:list', () => listEvents())
ipcMain.handle('events:load', (_e, id: string) => loadEvent(id))
ipcMain.handle('events:save', (_e, doc: { id: string }) => saveEvent(doc))
ipcMain.handle('events:delete', (_e, id: string) => deleteEvent(id))

async function pickSavePath(e: Electron.IpcMainInvokeEvent, defaultName: string, ext: string, label: string) {
  const win = BrowserWindow.fromWebContents(e.sender)!
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: [{ name: label, extensions: [ext] }] })
  return r.canceled || !r.filePath ? null : r.filePath
}

ipcMain.handle('export:csv', async (e, name: string, rows: string[][]) => {
  const path = await pickSavePath(e, `${name}.csv`, 'csv', 'CSV')
  if (!path) return null
  const esc = (v: string): string => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  await fs.writeFile(path, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), 'utf8')
  return path
})

ipcMain.handle('export:xlsx', async (e, name: string, sheets: { name: string; rows: string[][] }[]) => {
  const path = await pickSavePath(e, `${name}.xlsx`, 'xlsx', 'Excel')
  if (!path) return null
  const wb = new ExcelJS.Workbook()
  const used = new Set<string>()
  for (const s of sheets) {
    let n = s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja'
    for (let i = 2; used.has(n.toLowerCase()); i++) n = `${n.slice(0, 28)} ${i}`
    used.add(n.toLowerCase())
    const ws = wb.addWorksheet(n)
    s.rows.forEach((r) => ws.addRow(r))
    ws.getRow(1).font = { bold: true }
    ws.columns.forEach((c) => (c.width = 22))
  }
  await wb.xlsx.writeFile(path)
  return path
})

async function withHtmlWindow<T>(html: string, width: number, fn: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = new BrowserWindow({ show: false, width, height: 1000, webPreferences: { sandbox: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await fn(win)
  } finally {
    win.destroy()
  }
}

ipcMain.handle('export:pdf', async (e, name: string, html: string) => {
  const path = await pickSavePath(e, `${name}.pdf`, 'pdf', 'PDF')
  if (!path) return null
  const buf = await withHtmlWindow(html, 900, (w) => w.webContents.printToPDF({ printBackground: true, pageSize: 'A4' }))
  await fs.writeFile(path, buf)
  return path
})

ipcMain.handle('export:png', async (e, name: string, html: string) => {
  const path = await pickSavePath(e, `${name}.png`, 'png', 'PNG')
  if (!path) return null
  const buf = await withHtmlWindow(html, 900, async (w) => {
    const h = (await w.webContents.executeJavaScript('document.documentElement.scrollHeight', true)) as number
    w.setContentSize(900, Math.min(Math.max(h, 400), 16000))
    await new Promise((r) => setTimeout(r, 150))
    return (await w.webContents.capturePage()).toPNG()
  })
  await fs.writeFile(path, buf)
  return path
})

ipcMain.handle('window:toggleFullscreen', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  win.setFullScreen(!win.isFullScreen())
  return !win.isFullScreen()
})
ipcMain.handle('window:isFullscreen', (e) => BrowserWindow.fromWebContents(e.sender)?.isFullScreen() ?? false)

ipcMain.handle('present:open', (_e, data: unknown) => {
  presentData = data
  createWindow({ present: true })
})
ipcMain.handle('present:get', () => presentData)

void app.whenReady().then(async () => {
  await fs.mkdir(eventsDir(), { recursive: true })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

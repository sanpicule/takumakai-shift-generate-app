import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { writeFileSync } from 'fs'

const store = new Store()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.takumakikai.shift-scheduler')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // データ保存・読み込み
  ipcMain.handle('store:get', (_, key: string) => store.get(key))
  ipcMain.handle('store:set', (_, key: string, value: unknown) => store.set(key, value))
  ipcMain.handle('store:delete', (_, key: string) => store.delete(key))

  // canvas の dataURL から PDF を生成して保存
  ipcMain.handle('save-pdf-from-canvas', async (event, { dataUrl, defaultName }: { dataUrl: string; defaultName: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()!
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'PDFを保存',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { success: false }

    // 一時的な非表示ウィンドウで画像を読み込んで PDF 化
    const printWin = new BrowserWindow({ width: 1600, height: 900, show: false, webPreferences: { sandbox: false } })
    try {
      const html = `<!DOCTYPE html><html><head><style>
        body{margin:0;padding:0;background:#fff;}
        img{display:block;max-width:100%;height:auto;}
        @page{size:A3 landscape;margin:5mm;}
      </style></head><body><img src="${dataUrl}"/></body></html>`
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdfData = await printWin.webContents.printToPDF({
        landscape: true,
        pageSize: 'A3',
        printBackground: true
      })
      writeFileSync(filePath, pdfData)
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    } finally {
      printWin.close()
    }
  })

  // PNG画像として保存（base64 dataURL形式で受け取る）
  ipcMain.handle('save-png', async (event, { dataUrl, defaultName }: { dataUrl: string; defaultName: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? BrowserWindow.getFocusedWindow()!, {
      title: '画像を保存',
      defaultPath: defaultName,
      filters: [{ name: 'PNG画像', extensions: ['png'] }]
    })
    if (canceled || !filePath) return { success: false }
    try {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      writeFileSync(filePath, Buffer.from(base64, 'base64'))
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // CSVファイル保存ダイアログ
  ipcMain.handle('save-csv', async (_, { content, defaultName }: { content: string; defaultName: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'CSVファイルを保存',
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { success: false }
    try {
      writeFileSync(filePath, '\uFEFF' + content, 'utf8') // BOM付きUTF-8（Excelで開けるように）
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

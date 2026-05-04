/**
 * Inkwell desktop shell (Electron).
 * Production: custom `inkwell://` protocol serves the Vite `dist/` tree so module workers
 * and fetch behave like a normal https origin (avoids fragile `file://` semantics).
 * Development: load the Vite dev server at http://localhost:5173 (same origin as `npm run dev` in the browser).
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

const VITE_DEV_URL = 'http://localhost:5173'

/** @type {BrowserWindow | null} */
let mainWindow = null

/** @type {{ name: string, buffer: ArrayBuffer } | null} */
let pendingImportPayload = null

/** @type {string | null} */
let pendingAuthDeepLink = null

const isDev = !app.isPackaged

/**
 * @param {string} s
 */
function inkwellUrlFromArgvFragment(s) {
  const i = s.indexOf('inkwell://')
  if (i === -1) return null
  return s.slice(i).trim()
}

/**
 * @param {string} urlStr
 */
function isLikelySupabaseAuthCallbackUrl(urlStr) {
  if (!urlStr || !urlStr.startsWith('inkwell://')) return false
  try {
    const u = new URL(urlStr)
    const probe = `${u.search}${u.hash}`
    return /(?:^|[?&#])(?:code|error|token_hash|access_token|refresh_token)=/.test(probe)
  } catch {
    return false
  }
}

/**
 * @param {unknown} candidate
 */
function bufferAuthDeepLink(candidate) {
  if (typeof candidate !== 'string') return
  const url = inkwellUrlFromArgvFragment(candidate)
  if (!url || !isLikelySupabaseAuthCallbackUrl(url)) return
  pendingAuthDeepLink = url
}

/**
 * @param {readonly string[]} argv
 */
function collectAuthDeepLinksFromArgv(argv) {
  for (const a of argv) bufferAuthDeepLink(a)
}

function focusMainWindow() {
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
}

function deliverAuthDeepLinkIfAny() {
  const url = pendingAuthDeepLink
  if (!url || !mainWindow?.webContents) return
  pendingAuthDeepLink = null
  void mainWindow.loadURL(url)
  focusMainWindow()
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'inkwell',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function mimeForExt(ext) {
  const m = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  }
  return m[ext] || 'application/octet-stream'
}

/**
 * @param {string} distRoot absolute path to Vite output
 */
function registerInkwellProtocol(distRoot) {
  const rootResolved = path.resolve(distRoot)

  protocol.handle('inkwell', async (request) => {
    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
    const candidate = path.resolve(rootResolved, rel)
    const relToRoot = path.relative(rootResolved, candidate)
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const data = await fs.promises.readFile(candidate)
      return new Response(data, {
        headers: { 'Content-Type': mimeForExt(path.extname(candidate)) },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function shouldTryOpenAsInkwell(filePath) {
  const base = path.basename(filePath).toLowerCase()
  if (base.endsWith('.inkwell')) return true
  if (base.endsWith('.inkwell.zip')) return true
  if (base === 'inkwell-library-backup.zip') return true
  return false
}

/**
 * @param {string[]} argv
 */
async function queueFirstImportableFromArgv(argv) {
  const args = argv.slice(1)
  for (const a of args) {
    if (!a || a.startsWith('-')) continue
    try {
      if (!fs.existsSync(a)) continue
      const st = fs.statSync(a)
      if (!st.isFile()) continue
      if (!shouldTryOpenAsInkwell(a)) continue
      const buf = await fs.promises.readFile(a)
      pendingImportPayload = {
        name: path.basename(a),
        buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      }
      return
    } catch {
      /* ignore */
    }
  }
}

function distDir() {
  return path.join(__dirname, '..', 'dist')
}

function inkwellAuthKvPath() {
  return path.join(app.getPath('userData'), 'inkwell-supabase-auth.crypt')
}

function readInkwellAuthKvMap() {
  const fp = inkwellAuthKvPath()
  if (!fs.existsSync(fp)) return {}
  try {
    const buf = fs.readFileSync(fp)
    let raw
    if (safeStorage.isEncryptionAvailable()) raw = safeStorage.decryptString(buf)
    else raw = buf.toString('utf8')
    const o = JSON.parse(raw)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeInkwellAuthKvMap(m) {
  const fp = inkwellAuthKvPath()
  const raw = JSON.stringify(m)
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(raw) : Buffer.from(raw, 'utf8')
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  fs.writeFileSync(fp, data)
}

function sendPendingImportSignal() {
  if (!mainWindow?.webContents) return
  mainWindow.webContents.send('inkwell-pending-import')
}

/**
 * @param {BrowserWindow} win
 */
function buildAppMenu(win) {
  const isMac = process.platform === 'darwin'

  /** @param {string} action */
  const send = (action) => {
    win.webContents.send('inkwell-menu', action)
  }

  const template = [
    ...(isMac ?
      [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]
    : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Inkwell backup…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('import-backup'),
        },
        {
          label: 'Export current book backup…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send('export-book-backup'),
        },
        {
          label: 'Export full library backup…',
          click: () => send('export-library-backup'),
        },
        {
          label: 'Sync library with cloud…',
          accelerator: 'CmdOrCtrl+Shift+Y',
          click: () => send('sync-library-now'),
        },
        { type: 'separator' },
        {
          label: 'Toggle theme',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => send('toggle-theme'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', visible: isDev },
        { role: 'toggleDevTools', visible: isDev },
        { type: 'separator', visible: isDev },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  buildAppMenu(mainWindow)

  if (isDev) {
    pendingAuthDeepLink = null
    void mainWindow.loadURL(VITE_DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    let startUrl = 'inkwell://app/index.html'
    if (pendingAuthDeepLink && isLikelySupabaseAuthCallbackUrl(pendingAuthDeepLink)) {
      startUrl = pendingAuthDeepLink
      pendingAuthDeepLink = null
    }
    void mainWindow.loadURL(startUrl)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingImportPayload) sendPendingImportSignal()
  })
}

function registerIpcHandlers() {
  ipcMain.handle('inkwell:take-pending-import', () => {
    const p = pendingImportPayload
    pendingImportPayload = null
    return p
  })

  ipcMain.handle('inkwell:import-archive-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showOpenDialog(win ?? undefined, {
      title: 'Import Inkwell backup',
      properties: ['openFile'],
      filters: [
        { name: 'Inkwell archives', extensions: ['inkwell', 'zip'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (r.canceled || !r.filePaths[0]) return null
    const fp = r.filePaths[0]
    const buf = await fs.promises.readFile(fp)
    return {
      name: path.basename(fp),
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    }
  })

  ipcMain.handle('inkwell:save-book-backup', async (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const defaultBase =
      typeof payload?.defaultBase === 'string' && payload.defaultBase.trim() ?
        payload.defaultBase.trim().replace(/[/\\?%*:|"<>]/g, '_')
      : 'book'
    const r = await dialog.showSaveDialog(win ?? undefined, {
      title: 'Export book backup',
      defaultPath: `${defaultBase}.inkwell`,
      filters: [{ name: 'Inkwell archive', extensions: ['inkwell'] }],
    })
    if (r.canceled || !r.filePath) return { ok: false }
    const ab = payload?.buffer
    if (!(ab instanceof ArrayBuffer)) return { ok: false }
    await fs.promises.writeFile(r.filePath, Buffer.from(ab))
    return { ok: true, path: r.filePath }
  })

  ipcMain.handle('inkwell:auth-kv-get', (_event, key) => {
    if (typeof key !== 'string') return null
    const m = readInkwellAuthKvMap()
    const v = m[key]
    return typeof v === 'string' ? v : null
  })

  ipcMain.handle('inkwell:auth-kv-set', (_event, key, value) => {
    if (typeof key !== 'string') return
    const m = readInkwellAuthKvMap()
    if (value == null) delete m[key]
    else m[key] = String(value)
    writeInkwellAuthKvMap(m)
  })

  ipcMain.handle('inkwell:auth-kv-remove', (_event, key) => {
    if (typeof key !== 'string') return
    const m = readInkwellAuthKvMap()
    delete m[key]
    writeInkwellAuthKvMap(m)
  })

  ipcMain.handle('inkwell:save-library-backup', async (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showSaveDialog(win ?? undefined, {
      title: 'Export library backup',
      defaultPath: 'inkwell-library-backup.zip',
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
    })
    if (r.canceled || !r.filePath) return { ok: false }
    const ab = payload?.buffer
    if (!(ab instanceof ArrayBuffer)) return { ok: false }
    await fs.promises.writeFile(r.filePath, Buffer.from(ab))
    return { ok: true, path: r.filePath }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  registerIpcHandlers()

  if (process.platform === 'darwin') {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      bufferAuthDeepLink(url)
      deliverAuthDeepLinkIfAny()
    })
  }

  app.on('second-instance', (_event, argv) => {
    collectAuthDeepLinksFromArgv(argv)
    if (pendingAuthDeepLink) {
      deliverAuthDeepLinkIfAny()
    }
    void queueFirstImportableFromArgv(argv).then(() => {
      sendPendingImportSignal()
      mainWindow?.focus()
    })
  })

  app.whenReady().then(async () => {
    if (!isDev) {
      try {
        app.setAsDefaultProtocolClient('inkwell')
      } catch {
        /* ignore */
      }
    }

    collectAuthDeepLinksFromArgv(process.argv)
    await queueFirstImportableFromArgv(process.argv)

    if (!isDev) {
      registerInkwellProtocol(distDir())
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

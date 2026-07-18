/**
 * Inkwell desktop shell (Electron).
 * Production: custom `inkwell://` protocol serves the Vite `dist/` tree so module workers
 * and fetch behave like a normal https origin (avoids fragile `file://` semantics).
 * Development: load the Vite dev server at http://localhost:5173 (same origin as `npm run dev` in the browser).
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, session, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const VITE_DEV_URL = 'http://localhost:5173'
const PROD_APP_ORIGIN = 'inkwell://app'

/** @type {BrowserWindow | null} */
let mainWindow = null

/** @type {{ name: string, buffer: ArrayBuffer } | null} */
let pendingImportPayload = null

const isDev = !app.isPackaged

/**
 * URL of the frame that sent an IPC message. Prefer `senderFrame.url`; fall back to
 * `webContents.getURL()` because some Electron builds leave `senderFrame.url` empty for
 * custom-protocol documents (`inkwell://app/…`).
 * @param {Electron.IpcMainInvokeEvent | Electron.IpcMainEvent} event
 */
function senderNavigationUrl(event) {
  const frameUrl = event?.senderFrame?.url
  if (typeof frameUrl === 'string' && frameUrl.length > 0) return frameUrl
  try {
    const wc = event?.sender
    if (wc && typeof wc.getURL === 'function') {
      const u = wc.getURL()
      return typeof u === 'string' ? u : ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * Restrict all privileged actions (IPC, dialogs) to our own renderer.
 * @param {Electron.IpcMainInvokeEvent | Electron.IpcMainEvent} event
 */
function assertTrustedSender(event) {
  const frameUrl = senderNavigationUrl(event)
  const ok =
    (isDev && typeof frameUrl === 'string' && frameUrl.startsWith(VITE_DEV_URL)) ||
    (!isDev && typeof frameUrl === 'string' && frameUrl.startsWith(PROD_APP_ORIGIN))

  if (!ok) {
    const e = new Error('Untrusted sender')
    e.code = 'ERR_UNTRUSTED_SENDER'
    throw e
  }
}

/**
 * @param {string} urlStr
 */
function isAllowedNavigationTarget(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false
  if (isDev) return urlStr.startsWith(VITE_DEV_URL)
  return urlStr.startsWith(PROD_APP_ORIGIN)
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

function sendPendingImportSignal() {
  if (!mainWindow?.webContents) return
  mainWindow.webContents.send('inkwell-pending-import')
}

/** @type {import('electron-updater').AppUpdater | null} */
let inkwellAutoUpdater = null

/** True while the user asked for an explicit check (shows native dialogs on no update / errors). */
let manualInkwellUpdateCheck = false

/** True after `setupInkwellAutoUpdater` registered listeners (single global `autoUpdater`). */
let inkwellAutoUpdaterSetupDone = false

/**
 * GitHub Releases auto-update (NSIS). CI must attach `latest.yml` next to the installer on the same
 * `v{version}` release (see docs/DESKTOP.md). Full installer downloads only (no differential/blockmap).
 */
function setupInkwellAutoUpdater() {
  if (inkwellAutoUpdaterSetupDone) return
  if (isDev || !app.isPackaged || process.platform !== 'win32') return

  let autoUpdater
  try {
    ;({ autoUpdater } = require('electron-updater'))
  } catch (e) {
    console.warn('[inkwell] electron-updater unavailable', e)
    return
  }

  inkwellAutoUpdater = autoUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Hand-generated `latest.yml` (see scripts/write-nsis-latest-yml.mjs) omits embedded block-map metadata.
  autoUpdater.disableDifferentialDownload = true

  /** @param {unknown} payload */
  const send = (payload) => {
    const win = mainWindow
    if (!win || win.isDestroyed()) return
    try {
      win.webContents.send('inkwell:auto-update', payload)
    } catch {
      /* ignore */
    }
  }

  autoUpdater.on('checking-for-update', () => {
    send({ kind: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send({ kind: 'available', version: String(info?.version ?? '') })
  })

  autoUpdater.on('update-not-available', async () => {
    send({ kind: 'not-available' })
    if (manualInkwellUpdateCheck) {
      manualInkwellUpdateCheck = false
      try {
        await dialog.showMessageBox(mainWindow ?? undefined, {
          type: 'info',
          message: 'You are on the latest Inkwell.',
          buttons: ['OK'],
        })
      } catch {
        /* ignore */
      }
    }
  })

  autoUpdater.on('error', async (err) => {
    const message = err instanceof Error ? err.message : String(err)
    send({ kind: 'error', message })
    if (manualInkwellUpdateCheck) {
      manualInkwellUpdateCheck = false
      try {
        await dialog.showMessageBox(mainWindow ?? undefined, {
          type: 'warning',
          title: 'Update check failed',
          message: 'Could not reach the update server.',
          detail: message,
          buttons: ['OK'],
        })
      } catch {
        /* ignore */
      }
    }
  })

  autoUpdater.on('download-progress', (p) => {
    send({ kind: 'progress', percent: typeof p.percent === 'number' ? p.percent : 0 })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send({ kind: 'downloaded', version: String(info?.version ?? '') })
  })

  // Defer so first paint is not contending with GitHub on cold start.
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {})
  }, 12_000)

  inkwellAutoUpdaterSetupDone = true
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
        ...(app.isPackaged && process.platform === 'win32' ?
          [
            { type: 'separator' },
            {
              label: 'Check for updates…',
              click: () => {
                if (!mainWindow || mainWindow.isDestroyed()) return
                if (!inkwellAutoUpdater) return
                manualInkwellUpdateCheck = true
                void inkwellAutoUpdater.checkForUpdates().catch(() => {})
              },
            },
          ]
        : []),
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  /** Packaged Windows: ship `build/icon.ico` via `extraResources` so the window/taskbar can use the emblem. */
  let windowIcon
  if (!isDev && process.platform === 'win32') {
    const iconPath = path.join(process.resourcesPath, 'icon.ico')
    try {
      if (fs.existsSync(iconPath)) windowIcon = iconPath
    } catch {
      /* ignore */
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    /** Reduces initial flash; matches app dark chrome (see `color-scheme` / theme tokens). */
    backgroundColor: '#0f1113',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      /** Keep timers/animations smoother when the window is briefly backgrounded (e.g. menus, dialogs). */
      backgroundThrottling: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Never allow new windows; external links open in the OS browser.
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationTarget(url)) {
      event.preventDefault()
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        void shell.openExternal(url)
      }
    }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    setupInkwellAutoUpdater()
  })

  buildAppMenu(mainWindow)

  if (isDev) {
    void mainWindow.loadURL(VITE_DEV_URL)
    // Detached DevTools add noticeable overhead; opt in with INKWELL_ELECTRON_DEVTOOLS=1 (see docs/DESKTOP.md).
    if (process.env.INKWELL_ELECTRON_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    void mainWindow.loadURL('inkwell://app/index.html')
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingImportPayload) sendPendingImportSignal()
  })
}

function registerIpcHandlers() {
  ipcMain.handle('inkwell:take-pending-import', (event) => {
    assertTrustedSender(event)
    const p = pendingImportPayload
    pendingImportPayload = null
    return p
  })

  ipcMain.handle('inkwell:import-archive-dialog', async (event) => {
    assertTrustedSender(event)
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
    assertTrustedSender(event)
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

  ipcMain.handle('inkwell:save-library-backup', async (event, payload) => {
    assertTrustedSender(event)
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

  ipcMain.handle('inkwell:auto-update-check', async (event) => {
    assertTrustedSender(event)
    if (isDev || !app.isPackaged || process.platform !== 'win32') return { ok: false, reason: 'unsupported' }
    if (!inkwellAutoUpdater) return { ok: false, reason: 'not-ready' }
    manualInkwellUpdateCheck = true
    try {
      const r = await inkwellAutoUpdater.checkForUpdates()
      return { ok: true, version: r?.updateInfo?.version ?? null }
    } catch (e) {
      manualInkwellUpdateCheck = false
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('inkwell:auto-update-quit-install', (event) => {
    assertTrustedSender(event)
    if (!inkwellAutoUpdater) return { ok: false }
    try {
      inkwellAutoUpdater.quitAndInstall(false, true)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  registerIpcHandlers()

  app.on('second-instance', (_event, argv) => {
    void queueFirstImportableFromArgv(argv).then(() => {
      sendPendingImportSignal()
      mainWindow?.focus()
    })
  })

  app.whenReady().then(async () => {
    // Deny sensitive permissions by default. (Inkwell is a local-first editor.)
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      const denied = new Set(['media', 'geolocation', 'notifications', 'midi', 'clipboard-sanitized-write'])
      callback(!denied.has(permission))
    })

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

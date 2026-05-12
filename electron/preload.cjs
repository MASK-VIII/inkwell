const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('inkwellDesktop', {
  takePendingImport: () => ipcRenderer.invoke('inkwell:take-pending-import'),
  importArchiveDialog: () => ipcRenderer.invoke('inkwell:import-archive-dialog'),
  saveBookBackup: (defaultBase, buffer) =>
    ipcRenderer.invoke('inkwell:save-book-backup', { defaultBase, buffer }),
  saveLibraryBackup: (buffer) => ipcRenderer.invoke('inkwell:save-library-backup', { buffer }),
  authStorage: {
    getItem: (key) => ipcRenderer.invoke('inkwell:auth-kv-get', key),
    setItem: (key, value) => ipcRenderer.invoke('inkwell:auth-kv-set', key, value),
    removeItem: (key) => ipcRenderer.invoke('inkwell:auth-kv-remove', key),
  },
  onMenuAction: (handler) => {
    const listener = (_event, action) => {
      if (typeof action === 'string') handler(action)
    }
    ipcRenderer.on('inkwell-menu', listener)
    return () => ipcRenderer.removeListener('inkwell-menu', listener)
  },
  onPendingImport: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('inkwell-pending-import', listener)
    return () => ipcRenderer.removeListener('inkwell-pending-import', listener)
  },
  updates: {
    check: () => ipcRenderer.invoke('inkwell:auto-update-check'),
    quitAndInstall: () => ipcRenderer.invoke('inkwell:auto-update-quit-install'),
    onStatus: (handler) => {
      const listener = (_event, payload) => {
        handler(payload)
      }
      ipcRenderer.on('inkwell:auto-update', listener)
      return () => ipcRenderer.removeListener('inkwell:auto-update', listener)
    },
  },
})

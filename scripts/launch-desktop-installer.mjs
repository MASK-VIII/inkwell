/**
 * After `npm run build:desktop`, launches the generated installer so the app
 * actually installs (build alone only writes artifacts under `release/`).
 *
 * Run: node scripts/launch-desktop-installer.mjs
 */
import { readdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')

/** @param {string[]} names */
async function newestPath(names) {
  let best = /** @type {{ path: string, mtime: number } | null} */ (null)
  for (const name of names) {
    const p = join(releaseDir, name)
    try {
      const s = await stat(p)
      if (!best || s.mtimeMs > best.mtime) best = { path: p, mtime: s.mtimeMs }
    } catch {
      /* skip */
    }
  }
  return best?.path ?? null
}

let files
try {
  files = await readdir(releaseDir)
} catch {
  console.error(`No release folder at ${releaseDir}. Run npm run build:desktop first.`)
  process.exit(1)
}

const platform = process.platform

if (platform === 'win32') {
  const setups = files.filter(
    (f) => f.toLowerCase().startsWith('inkwell setup') && f.toLowerCase().endsWith('.exe')
  )
  const installPath = await newestPath(setups)
  if (!installPath) {
    console.error(`No "Inkwell Setup *.exe" found in ${releaseDir}.`)
    process.exit(1)
  }
  console.log('')
  console.log('Installer ready — opening setup wizard (check taskbar if it opens behind other windows).')
  console.log(installPath)
  console.log('')
  /* `cmd /c start "" <exe>` foregrounds more reliably than spawning the .exe detached. */
  const child = spawn('cmd.exe', ['/c', 'start', '', installPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()
} else if (platform === 'darwin') {
  const dmgs = files.filter((f) => f.endsWith('.dmg') && /^Inkwell\b/i.test(f))
  const path = await newestPath(dmgs)
  if (!path) {
    console.error(`No Inkwell *.dmg found in ${releaseDir}.`)
    process.exit(1)
  }
  console.log('Opening disk image:', path)
  const child = spawn('open', [path], { detached: true, stdio: 'ignore' })
  child.unref()
} else {
  console.error('Automatic launch is only wired for Windows (.exe) and macOS (.dmg).')
  console.error(`Artifacts should be under: ${releaseDir}`)
  process.exit(1)
}

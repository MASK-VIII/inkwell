/**
 * Runs electron-builder with `directories.output` under os.tmpdir() so a locked
 * `release/win-unpacked` tree cannot break rebuilds. Copies artifacts into `release/`
 * for installers, CI upload-artifact paths, and launch-desktop-installer.mjs.
 */
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, rename, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')
const stamp = `${Date.now()}`
const packOut = join(tmpdir(), `inkwell-ebuild-${stamp}`)
const markerFile = join(root, '.inkwell-last-pack-dir')

await mkdir(packOut, { recursive: true })

// electron-builder --config replaces package.json "build" entirely — merge so
// productName / win.artifactName / nsis / publish stay intact.
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const build = pkg.build && typeof pkg.build === 'object' ? { ...pkg.build } : {}
const directories =
  build.directories && typeof build.directories === 'object' ? { ...build.directories } : {}
directories.output = packOut
build.directories = directories

const cfgPath = join(tmpdir(), `inkwell-ebuilder-${stamp}.json`)
await writeFile(cfgPath, JSON.stringify(build, null, 0), 'utf8')

console.log('[desktop-pack] electron-builder output:', packOut)

const r = spawnSync('npx', ['electron-builder', '--publish', 'never', '--config', cfgPath], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

await rm(cfgPath, { force: true }).catch(() => {})

if (r.status !== 0) {
  process.exit(r.status ?? 1)
}

await writeFile(markerFile, packOut, 'utf8')

await mkdir(releaseDir, { recursive: true })

try {
  await cp(packOut, releaseDir, { recursive: true, force: true })
  console.log('[desktop-pack] Synced artifacts to:', releaseDir)
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.warn('[desktop-pack] Bulk copy to release/ failed:', msg)
  console.warn('[desktop-pack] Retrying per entry (installer may still copy). Full tree:', packOut)
  const names = await readdir(packOut)
  for (const name of names) {
    const src = join(packOut, name)
    const dest = join(releaseDir, name)
    try {
      const st = await stat(src)
      if (st.isDirectory()) {
        await cp(src, dest, { recursive: true, force: true })
      } else {
        await cp(src, dest, { force: true })
      }
    } catch (err) {
      console.warn(`[desktop-pack] Skip ${name}:`, err instanceof Error ? err.message : err)
    }
  }
}

// Canonical Windows installer name (matches package.json build.win.artifactName).
if (process.platform === 'win32') {
  const version = String(pkg.version ?? '').trim()
  if (version) {
    const canonical = `Inkwell-Setup-${version}.exe`
    const names = await readdir(releaseDir)
    const already = names.some((n) => n.toLowerCase() === canonical.toLowerCase())
    if (!already) {
      const verEsc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const legacy = names.find((n) => new RegExp(`^inkwell\\s+Setup\\s+${verEsc}\\.exe$`, 'i').test(n))
      if (legacy) {
        await rename(join(releaseDir, legacy), join(releaseDir, canonical))
        console.log(`[desktop-pack] Renamed ${legacy} → ${canonical}`)
        const blockLegacy = `${legacy}.blockmap`
        if (names.includes(blockLegacy)) {
          await rename(join(releaseDir, blockLegacy), join(releaseDir, `${canonical}.blockmap`))
        }
      }
    }
  }
}

const meta = spawnSync(process.execPath, [join(root, 'scripts', 'write-nsis-latest-yml.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
if (meta.status !== 0) {
  process.exit(meta.status ?? 1)
}

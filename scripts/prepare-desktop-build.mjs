/**
 * Stop Inkwell so nothing holds `app.asar` open during pack.
 * Packaging itself writes to a fresh temp directory (run-desktop-pack.mjs), not `release/win-unpacked`,
 * so wedged folders under `release/` no longer block builds.
 */
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const exe = 'Inkwell.exe'

if (process.platform !== 'win32') {
  process.exit(0)
}

try {
  const listing = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${exe}`, '/NH', '/FO', 'CSV'], {
    encoding: 'utf8',
  })
  if (listing.includes(exe)) {
    console.log(`[prepare-desktop-build] Closing ${exe} before packaging …`)
    execFileSync('taskkill', ['/IM', exe, '/F'], { stdio: 'inherit' })
    await delay(800)
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('[prepare-desktop-build]', msg)
}

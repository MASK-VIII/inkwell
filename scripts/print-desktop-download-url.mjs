/**
 * Prints the GitHub Releases "latest" asset URL for the Windows NSIS installer.
 * Use this value for VITE_INKWELL_DESKTOP_DOWNLOAD_URL after you publish a release
 * that includes the matching `Inkwell-Setup-<version>.exe` asset.
 *
 * Run: node scripts/print-desktop-download-url.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = String(pkg.version ?? '0.0.0')
const fileBase = `Inkwell-Setup-${version}.exe`
const encoded = encodeURIComponent(fileBase)

/** @returns {string | null} */
function gitHubOwnerRepoFromOrigin() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    const m =
      url.match(/git@github\.com:([^/]+)\/([^/.]+)/i) ??
      url.match(/github\.com[:/]([^/]+)\/([^/.]+)/i)
    if (!m) return null
    return `${m[1]}/${m[2]}`
  } catch {
    return null
  }
}

const ownerRepo = gitHubOwnerRepoFromOrigin() ?? 'OWNER/REPO'
const url = `https://github.com/${ownerRepo}/releases/latest/download/${encoded}`

console.log('')
console.log('NSIS installer filename (must match uploaded GitHub Release asset):')
console.log(`  ${fileBase}`)
console.log('')
console.log('Paste this as VITE_INKWELL_DESKTOP_DOWNLOAD_URL (Vercel + .env.local):')
console.log(url)
console.log('')
console.log('Requires a published GitHub Release whose latest tag includes that .exe under Assets.')
console.log(`Local build output (see package.json build.directories.output): check for "${fileBase}".`)
console.log('Ship desktop only via Actions → Publish desktop installer (or tag + Release desktop).')
console.log('')

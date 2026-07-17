/**
 * When VITE_SITE_UNAVAILABLE=1 (Vercel Production), replace the SPA entry with a static
 * maintenance page and remove public installer artifacts from dist/.
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')

function isSiteUnavailable() {
  const raw = process.env.VITE_SITE_UNAVAILABLE?.trim()
  return raw === '1' || raw?.toLowerCase() === 'true'
}

function main() {
  if (!isSiteUnavailable()) {
    console.log('[apply-site-availability] normal build (VITE_SITE_UNAVAILABLE not set)')
    return
  }

  const maintenancePath = join(root, 'public', 'maintenance.html')
  const indexPath = join(distDir, 'index.html')
  const downloadsPath = join(distDir, 'downloads')

  if (!existsSync(indexPath)) {
    throw new Error(`[apply-site-availability] missing ${indexPath} — run vite build first`)
  }

  const maintenanceHtml = readFileSync(maintenancePath, 'utf8')
  writeFileSync(indexPath, maintenanceHtml, 'utf8')
  console.log('[apply-site-availability] replaced dist/index.html with maintenance page')

  if (existsSync(downloadsPath)) {
    rmSync(downloadsPath, { recursive: true, force: true })
    console.log('[apply-site-availability] removed dist/downloads/')
  }
}

main()

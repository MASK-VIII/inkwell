/**
 * CI guard: Vite must inline VITE_SUPABASE_* into dist/ before electron-builder packs.
 * If this fails, installers show "Cloud sign-in is not in this build" even when secrets exist.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
const anon = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
const pub = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

if (!url) {
  console.error('[verify-desktop-renderer] VITE_SUPABASE_URL must be set for this check.')
  process.exit(1)
}
if (!anon && !pub) {
  console.error('[verify-desktop-renderer] Set VITE_SUPABASE_ANON_KEY and/or VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(1)
}

const assetsDir = join(process.cwd(), 'dist', 'assets')
if (!existsSync(assetsDir)) {
  console.error('[verify-desktop-renderer] Missing dist/assets — run vite build first.')
  process.exit(1)
}

let blob = ''
for (const f of readdirSync(assetsDir)) {
  if (f.endsWith('.js')) blob += readFileSync(join(assetsDir, f), 'utf8')
}

if (!blob.includes(url)) {
  console.error(
    '[verify-desktop-renderer] VITE_SUPABASE_URL not found in dist/assets/*.js — env did not reach the Vite build.',
  )
  process.exit(1)
}
const keyOk = (anon && blob.includes(anon)) || (pub && blob.includes(pub))
if (!keyOk) {
  console.error(
    '[verify-desktop-renderer] Supabase key(s) not found in dist/assets/*.js — env did not reach the Vite build.',
  )
  process.exit(1)
}

console.log('[verify-desktop-renderer] Supabase URL and configured key(s) found inlined in renderer bundle.')

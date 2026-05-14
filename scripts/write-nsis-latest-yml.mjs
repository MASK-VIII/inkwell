/**
 * Writes `release/latest.yml` for Windows NSIS + GitHub Releases when electron-builder
 * is run with `--publish never` (no publish step => no generated channel metadata).
 * Matches the shape expected by electron-updater (see `electron-updater` Provider.js).
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')

function yamlScalar(s) {
  if (/^[\w.+-]+$/.test(s)) return s
  return JSON.stringify(s)
}

async function sha512Base64OfFile(filePath) {
  const hash = createHash('sha512')
  await new Promise((resolve, reject) => {
    const rs = createReadStream(filePath)
    rs.on('data', (c) => hash.update(c))
    rs.on('error', reject)
    rs.on('end', resolve)
  })
  return hash.digest('base64')
}

async function main() {
  const raw = await readFile(join(root, 'package.json'), 'utf8')
  const pkg = JSON.parse(raw)
  const version = String(pkg.version ?? '').trim()
  if (!version) {
    console.error('[write-nsis-latest-yml] package.json missing version')
    process.exit(1)
  }
  const productName = String(pkg.build?.productName ?? pkg.name ?? 'Inkwell').trim() || 'Inkwell'
  const expectedName = `${productName} Setup ${version}.exe`

  let names
  try {
    names = await readdir(releaseDir)
  } catch (e) {
    console.error('[write-nsis-latest-yml] cannot read release/:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const exes = names.filter((n) => n.toLowerCase().endsWith('.exe'))
  const verEsc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const setupRe = new RegExp(`^(.+)\\s+Setup\\s+${verEsc}\\.exe$`, 'i')
  const matches = exes
    .map((n) => {
      const m = setupRe.exec(n)
      return m ? { n, base: m[1] } : null
    })
    .filter(Boolean)
  const want = productName.toLowerCase()
  matches.sort((a, b) => {
    const da = a.base.toLowerCase() === want ? 0 : 1
    const db = b.base.toLowerCase() === want ? 0 : 1
    if (da !== db) return da - db
    return a.n.length - b.n.length
  })
  let exeName = matches[0]?.n ?? null
  if (exeName == null) {
    const head = productName.trim().replace(/\s+/g, '.')
    const dotCandidate = `${head}.Setup.${version}.exe`
    exeName = exes.find((n) => n.toLowerCase() === dotCandidate.toLowerCase()) ?? null
  }
  if (exeName == null) {
    console.error(
      '[write-nsis-latest-yml] No NSIS .exe in release/. Expected something like',
      JSON.stringify(expectedName),
      'found:',
      exes.join(', ') || '(none)',
    )
    process.exit(1)
  }

  const exePath = join(releaseDir, exeName)
  const st = await stat(exePath)
  const sha512 = await sha512Base64OfFile(exePath)
  const releaseDate = new Date().toISOString()

  const q = yamlScalar(exeName)
  const yml =
    `version: ${yamlScalar(version)}\n` +
    `files:\n` +
    `  - url: ${q}\n` +
    `    sha512: ${sha512}\n` +
    `    size: ${st.size}\n` +
    `path: ${q}\n` +
    `sha512: ${sha512}\n` +
    `releaseDate: '${releaseDate}'\n`

  const outPath = join(releaseDir, 'latest.yml')
  await writeFile(outPath, yml, 'utf8')
  console.log('[write-nsis-latest-yml] wrote', outPath, 'for', exeName)
}

await main()

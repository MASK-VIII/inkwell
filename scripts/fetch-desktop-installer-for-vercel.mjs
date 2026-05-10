/**
 * Download the Windows NSIS installer from a private GitHub Release during Vercel production builds.
 *
 * Runs when:
 * - VERCEL=1 and VERCEL_ENV=production, or
 * - INKWELL_FETCH_DESKTOP_INSTALLER=1 (local / forced), or
 * - VERCEL=1 and INKWELL_FETCH_DESKTOP_INSTALLER_ON_PREVIEW=1
 *
 * Requires INKWELL_GITHUB_RELEASE_TOKEN (classic PAT: repo scope, read-only is enough).
 * Emergency bypass (build without installer): INKWELL_SKIP_DESKTOP_INSTALLER_FETCH=1 on Vercel.
 * Optional: INKWELL_GITHUB_OWNER_REPO or VITE_INKWELL_GITHUB_OWNER_REPO (default: git remote or MASK-VIII/inkwell).
 *
 * Writes: public/downloads/Inkwell-Setup-latest.exe (gitignored)
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = String(pkg.version ?? '0.0.0')
const productName = String(pkg.build?.productName ?? pkg.name ?? 'Inkwell')
const assetName = `${productName} Setup ${version}.exe`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function gitHubOwnerRepoFromOrigin() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    const m =
      url.match(/git@github\.com:([^/]+)\/([^/.]+)/i) ?? url.match(/github\.com[:/]([^/]+)\/([^/.]+)/i)
    if (!m) return null
    return `${m[1]}/${m[2]}`
  } catch {
    return null
  }
}

function resolveOwnerRepo() {
  const fromEnv =
    process.env.INKWELL_GITHUB_OWNER_REPO?.trim() || process.env.VITE_INKWELL_GITHUB_OWNER_REPO?.trim()
  if (fromEnv && /^[\w.-]+\/[\w.-]+$/.test(fromEnv)) return fromEnv
  return gitHubOwnerRepoFromOrigin() ?? 'MASK-VIII/inkwell'
}

function shouldRun() {
  if (process.env.INKWELL_FETCH_DESKTOP_INSTALLER === '1') return true
  if (process.env.VERCEL !== '1') return false
  if (process.env.VERCEL_ENV === 'production') return true
  return process.env.INKWELL_FETCH_DESKTOP_INSTALLER_ON_PREVIEW === '1'
}

async function githubJson(url, token) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'inkwell-fetch-desktop-installer',
    },
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { res, data }
}

async function downloadAsset(apiAssetUrl, token, destFile) {
  const res = await fetch(apiAssetUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'inkwell-fetch-desktop-installer',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Asset download failed ${res.status}: ${errText.slice(0, 500)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(destFile, buf)
}

async function main() {
  if (process.env.INKWELL_SKIP_DESKTOP_INSTALLER_FETCH === '1') {
    console.log('[fetch-desktop-installer] skipped (INKWELL_SKIP_DESKTOP_INSTALLER_FETCH=1)')
    return
  }

  if (!shouldRun()) {
    console.log('[fetch-desktop-installer] skipped (not a targeted Vercel build / no force flag)')
    return
  }

  const token =
    process.env.INKWELL_GITHUB_RELEASE_TOKEN?.trim() ||
    process.env.GITHUB_RELEASE_TOKEN?.trim() ||
    ''

  if (!token) {
    console.warn(
      '[fetch-desktop-installer] skipped: set INKWELL_GITHUB_RELEASE_TOKEN on Vercel (classic PAT, repo read)',
    )
    return
  }

  const ownerRepo = resolveOwnerRepo()
  const [owner, repo] = ownerRepo.split('/')
  if (!owner || !repo) {
    throw new Error(`Invalid owner/repo: ${ownerRepo}`)
  }

  const tag = `v${version}`
  const releasesTagUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`

  console.log(`[fetch-desktop-installer] repo=${ownerRepo} tag=${tag} asset="${assetName}"`)

  const destDir = join(root, 'public', 'downloads')
  const destFile = join(destDir, 'Inkwell-Setup-latest.exe')

  // Windows desktop CI often takes several minutes after a version bump lands on main.
  const maxAttempts = 22
  const delayMs = 18_000

  /** @type {{ assets?: { name?: string; url?: string }[] } | null} */
  let release = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { res, data } = await githubJson(releasesTagUrl, token)
    if (res.status === 200 && data && typeof data === 'object' && Array.isArray(data.assets)) {
      release = data
      break
    }
    if (res.status === 404 && attempt < maxAttempts) {
      console.warn(
        `[fetch-desktop-installer] release ${tag} not ready yet (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs / 1000}s…`,
      )
      await sleep(delayMs)
      continue
    }
    const msg =
      typeof data === 'object' && data && 'message' in data ?
        String(data.message)
      : await Promise.resolve(String(res.status))
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `GitHub API ${res.status} (${msg}). Regenerate a classic PAT with "repo" scope, ` +
          `set Vercel secret INKWELL_GITHUB_RELEASE_TOKEN exactly (no quotes/spaces), redeploy Production.`,
      )
    }
    throw new Error(`GitHub releases/tags/${tag} failed: ${res.status} ${msg}`)
  }

  if (!release?.assets?.length) {
    throw new Error(`Release ${tag} has no assets`)
  }

  const asset = release.assets.find((a) => a?.name === assetName)
  if (!asset?.url) {
    throw new Error(`Release ${tag} has no asset named "${assetName}"`)
  }

  await mkdir(destDir, { recursive: true })
  console.log(`[fetch-desktop-installer] downloading ${assetName} → public/downloads/Inkwell-Setup-latest.exe`)
  await downloadAsset(asset.url, token, destFile)
  console.log('[fetch-desktop-installer] done')
}

main().catch((err) => {
  console.error('[fetch-desktop-installer]', err)
  process.exit(1)
})

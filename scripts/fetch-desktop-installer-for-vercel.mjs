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
 *
 * Desktop releases are manual (Actions → Publish desktop installer). This script prefers
 * tag v{package.json version}, then falls back to /releases/latest without a long poll.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = String(pkg.version ?? '0.0.0')
const assetName = `Inkwell-Setup-${version}.exe`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function gitHubOwnerRepoFromOrigin() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
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

function normalizeInstallerFilename(s) {
  return s.replace(/\s+/g, ' ').trim()
}

/** True if filename looks like an Inkwell NSIS setup for this semver. */
function exeMatchesVersion(name, semver) {
  const n = name.toLowerCase()
  const v = semver.toLowerCase()
  if (n === `inkwell-setup-${v}.exe`) return true
  if (n.endsWith(` setup ${v}.exe`)) return true
  if (n === `inkwell.setup.${v}.exe`) return true
  return false
}

/**
 * NSIS artifact sometimes ships as `Product.Setup.1.2.3.exe` (dots) instead of spaced names.
 * @param {string} expectedName e.g. `Inkwell-Setup-1.0.0.exe` or legacy spaced form
 */
function alternateNames(expectedName) {
  const out = new Set([expectedName])
  const m = expectedName.match(/^(.+?)\s+Setup\s+(.+)$/i)
  if (m) {
    const head = m[1].trim().replace(/\s+/g, '.')
    out.add(`${head}.Setup.${m[2].trim()}`)
  }
  const dash = expectedName.match(/^Inkwell-Setup-(.+)\.exe$/i)
  if (dash) {
    out.add(`Inkwell Setup ${dash[1]}.exe`)
    out.add(`Inkwell.Setup.${dash[1]}.exe`)
    out.add(`inkwell Setup ${dash[1]}.exe`)
  }
  return [...out]
}

/**
 * @param {{ name?: string; url?: string }[]} assets
 * @returns {{ asset: { name?: string; url?: string } | null; hint: string }}
 */
function pickInstallerAsset(assets, expectedName, semver) {
  const exes = assets.filter((a) => a?.name && /\.exe$/i.test(a.name))
  const namesForHint =
    exes.length ? exes.map((a) => JSON.stringify(a.name)).join(', ')
    : assets.map((a) => JSON.stringify(a.name)).filter(Boolean).join(', ') || '(none)'

  if (!exes.length) {
    return { asset: null, hint: `No .exe in release assets. Saw: ${namesForHint}` }
  }

  for (const name of alternateNames(expectedName)) {
    let hit = exes.find((a) => a.name === name)
    if (hit) return { asset: hit, hint: '' }
    hit = exes.find((a) => normalizeInstallerFilename(a.name ?? '') === normalizeInstallerFilename(name))
    if (hit) return { asset: hit, hint: '' }
    hit = exes.find((a) => (a.name ?? '').toLowerCase() === name.toLowerCase())
    if (hit) return { asset: hit, hint: '' }
  }

  const versionHits = exes.filter((a) => exeMatchesVersion(a.name ?? '', semver))
  if (versionHits.length === 1) return { asset: versionHits[0], hint: '' }

  // Prefer any Inkwell-Setup-*.exe on /releases/latest fallback
  const setupHits = exes.filter((a) => /^inkwell-setup-.+\.exe$/i.test(a.name ?? ''))
  if (setupHits.length === 1) return { asset: setupHits[0], hint: '' }

  return {
    asset: null,
    hint: `Expected ${JSON.stringify(expectedName)}. Available .exe: ${exes.map((a) => JSON.stringify(a.name)).join(', ')}`,
  }
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

function isSiteUnavailable() {
  const raw = process.env.VITE_SITE_UNAVAILABLE?.trim()
  return raw === '1' || raw?.toLowerCase() === 'true'
}

async function main() {
  if (isSiteUnavailable()) {
    console.log('[fetch-desktop-installer] skipped (VITE_SITE_UNAVAILABLE=1)')
    return
  }

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

  // Desktop publishes are manual — do not wait many minutes for a tag that may not exist yet.
  const maxAttempts = 3
  const delayMs = 5_000

  /** @type {{ assets?: { name?: string; url?: string }[]; tag_name?: string } | null} */
  let release = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { res, data } = await githubJson(releasesTagUrl, token)
    if (res.status === 200 && data && typeof data === 'object' && Array.isArray(data.assets)) {
      if (data.assets.length === 0 && attempt < maxAttempts) {
        console.warn(
          `[fetch-desktop-installer] release ${tag} exists but has no assets yet (attempt ${attempt}/${maxAttempts}); retrying…`,
        )
        await sleep(delayMs)
        continue
      }
      release = data
      break
    }
    if (res.status === 404 && attempt < maxAttempts) {
      console.warn(
        `[fetch-desktop-installer] release ${tag} not ready yet (attempt ${attempt}/${maxAttempts}); retrying…`,
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
    if (res.status === 404 && attempt === maxAttempts) {
      break
    }
    if (res.status !== 404) {
      throw new Error(`GitHub releases/tags/${tag} failed: ${res.status} ${msg}`)
    }
  }

  if (!release?.assets?.length) {
    const latestUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    console.warn(`[fetch-desktop-installer] trying fallback GET /releases/latest (tag ${tag} unavailable)`)
    const { res: lr, data: latestData } = await githubJson(latestUrl, token)
    if (lr.status === 200 && latestData && typeof latestData === 'object' && Array.isArray(latestData.assets)) {
      release = latestData
      console.warn(
        `[fetch-desktop-installer] using latest release ${latestData.tag_name ?? '(unknown)'} — run Actions → Publish desktop installer after bumping package.json`,
      )
    } else if (lr.status === 401 || lr.status === 403) {
      const msg =
        typeof latestData === 'object' && latestData && 'message' in latestData ?
          String(latestData.message)
        : String(lr.status)
      throw new Error(`GitHub API ${lr.status} (${msg}) on /releases/latest.`)
    }
  }

  if (!release?.assets?.length) {
    throw new Error(
      `No release assets for ${tag} and /releases/latest had no usable assets — run GitHub Actions → Publish desktop installer (or Release desktop) when you intend to ship a desktop build.`,
    )
  }

  const { asset, hint } = pickInstallerAsset(release.assets, assetName, version)
  if (!asset?.url) {
    throw new Error(
      `${hint} — Run GitHub Actions → Publish desktop installer until it succeeds, ` +
        `or attach ${JSON.stringify(assetName)} under ${tag} on GitHub.`,
    )
  }

  await mkdir(destDir, { recursive: true })
  const picked = asset.name ?? assetName
  console.log(`[fetch-desktop-installer] downloading ${JSON.stringify(picked)} → public/downloads/Inkwell-Setup-latest.exe`)
  await downloadAsset(asset.url, token, destFile)
  console.log('[fetch-desktop-installer] done')
}

main().catch((err) => {
  console.error('[fetch-desktop-installer]', err)
  process.exit(1)
})

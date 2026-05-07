import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Generates `public/changelog.json` from git commit messages.
 *
 * Only includes commits that start with:
 *   - `changelog: ` (recommended)
 *   - `fix: ` / `feat: ` (optional convenience)
 *
 * Write subjects for people using Inkwell—not for developers scanning git:
 * - Say what they will notice (benefit or outcome), in plain words.
 * - Avoid file paths, component names, libraries, ticket IDs, and abbreviations (API, PR, RLS, JWT).
 * - Prefer short everyday words over jargon (“Sign in from your profile” beats “Expose onGoToSignIn on InkwellProfileMenu”).
 *
 * Examples:
 *   changelog: Clearer pricing on the website
 *   changelog: Sign-in option in the profile menu when working offline
 *   fix: Export dialog no longer hangs on long books
 */

const OUT_PATH = join(process.cwd(), 'public', 'changelog.json')

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function safeRun(cmd) {
  try {
    return run(cmd)
  } catch {
    return ''
  }
}

const MAX_ITEMS = 4

const raw = safeRun(
  [
    'git log',
    '--max-count=40',
    '--date=short',
    '--pretty=format:%H%x1f%ad%x1f%s',
  ].join(' '),
)

const lines = raw ? raw.split('\n') : []

const items = lines
  .map((line) => {
    const [hash, date, subject] = line.split('\x1f')
    if (!hash || !date || !subject) return null
    const s = subject.trim()

    const prefixes = ['changelog: ', 'feat: ', 'fix: ']
    const prefix = prefixes.find((p) => s.toLowerCase().startsWith(p))
    if (!prefix) return null

    const title = s.slice(prefix.length).trim()
    if (!title) return null

    const kind = prefix.startsWith('changelog') ? 'changelog' : prefix.replace(': ', '')
    return { kind, date, title, hash: hash.slice(0, 7) }
  })
  .filter(Boolean)
  .slice(0, MAX_ITEMS)

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      items,
    },
    null,
    2,
  ) + '\n',
)


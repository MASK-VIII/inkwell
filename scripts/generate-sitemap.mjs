/**
 * Writes public/sitemap.xml from static marketing URLs + guide slugs parsed from guideRegistry.ts
 * (keeps sitemap in sync without duplicating slug lists in JS).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site = 'https://inkwell.enterthelimelight.com'

const staticPaths = [
  '/',
  '/pricing',
  '/buy',
  '/privacy',
  '/terms',
  '/refund',
  '/changelog',
  '/guides',
]

const registryPath = join(root, 'src', 'marketing', 'guides', 'guideRegistry.ts')
const registrySrc = readFileSync(registryPath, 'utf8')
const slugMatches = [...registrySrc.matchAll(/\bslug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
const seen = new Set()
const guideSlugs = []
for (const s of slugMatches) {
  if (!seen.has(s)) {
    seen.add(s)
    guideSlugs.push(s)
  }
}

const urls = [...staticPaths, ...guideSlugs.map((s) => `/guides/${s}`)]

const urlEntries = urls
  .map((path) => {
    const loc = `${site}${path}`
    const priority =
      path === '/' ? '1.0'
      : path === '/guides' || path === '/pricing' || path === '/buy' ? '0.85'
      : path.startsWith('/guides/') ? '0.75'
      : path === '/changelog' ? '0.4'
      : '0.3'
    const changefreq =
      path === '/' || path === '/pricing' || path === '/buy' || path === '/changelog' || path.startsWith('/guides') ?
        'weekly'
      : 'monthly'
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`

const outPath = join(root, 'public', 'sitemap.xml')
writeFileSync(outPath, xml, 'utf8')
console.log('[sitemap] wrote', outPath, 'urls:', urls.length)

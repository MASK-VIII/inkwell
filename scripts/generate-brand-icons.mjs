import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const faviconSvg = join(root, 'public', 'favicon.svg')
const outDir = join(root, 'build')
const icon512 = join(outDir, 'icon.png')
const apple180 = join(root, 'public', 'apple-touch-icon.png')

await mkdir(outDir, { recursive: true })
const svg = await readFile(faviconSvg)
await sharp(svg).resize(512, 512).png().toFile(icon512)
await sharp(svg).resize(180, 180).png().toFile(apple180)
console.log('Wrote', icon512, 'and', apple180)

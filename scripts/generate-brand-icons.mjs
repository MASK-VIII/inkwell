import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import png2icons from 'png2icons'

/** Windows often returns UNKNOWN (-4094) when AV/indexers briefly lock outputs under `build/`. */
async function writeFileRobust(filePath, data) {
  const attempts = 10
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      await writeFile(filePath, data)
      return
    } catch (e) {
      lastErr = e
      await unlink(filePath).catch(() => {})
      await new Promise((r) => setTimeout(r, 120 * (i + 1)))
    }
  }
  throw lastErr
}

/**
 * Web PWA / apple-touch icons rasterize from `public/brand/inkwell-emblem.png`.
 * Desktop `.ico` / `.icns` use `public/brand/inkwell-emblem-desktop.png` when
 * present (optional alternate master for shortcuts); otherwise the same emblem
 * as web. Dedicated desktop assets may use a circular alpha mask so Explorer
 * shows a round emblem instead of a black square tile.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const faviconSvg = join(root, 'public', 'favicon.svg')
const emblemPng = join(root, 'public', 'brand', 'inkwell-emblem.png')
const emblemDesktopPng = join(root, 'public', 'brand', 'inkwell-emblem-desktop.png')
const buildDir = join(root, 'build')
const apple180 = join(root, 'public', 'apple-touch-icon.png')

await mkdir(buildDir, { recursive: true })

/* Web: 180x180 apple-touch-icon (iOS homescreen icon).
   Use the emblem so home-screen shortcuts match the in-app branding. */
const svg = await readFile(faviconSvg)

/* Desktop: tight-disc emblem master + multi-size .ico / .icns.
   Geometry mirrors src/components/InkwellEmblem.tsx (scale 1.36 with
   object-[50%_47%]): we visibly use ~73.5% of the source, shifted ~3%
   above center to track the disc. */
const SIZE = 1024
const DESKTOP_CROP_FRAC = 0.735
/* Mobile/web icons should avoid showing the emblem's dark corners on squared home-screen masks.
   Crop a bit tighter so the gold disc fills the square (gold may clip; no black edges). */
const WEB_CROP_FRAC = 0.62
const yBiasFrac = -0.03

const meta = await sharp(emblemPng).metadata()
if (!meta.width || !meta.height) throw new Error('Could not read emblem dimensions')
function cropSquare(sourceMeta, cropFrac) {
  const side = Math.round(Math.min(sourceMeta.width, sourceMeta.height) * cropFrac)
  const left = Math.round((sourceMeta.width - side) / 2)
  const topRaw = Math.round((sourceMeta.height - side) / 2 + sourceMeta.height * yBiasFrac)
  const top = Math.max(0, Math.min(topRaw, sourceMeta.height - side))
  return { left, top, side }
}

let desktopSourcePath = emblemPng
try {
  await stat(emblemDesktopPng)
  desktopSourcePath = emblemDesktopPng
} catch {
  /* optional */
}

const desktopMeta = await sharp(desktopSourcePath).metadata()
if (!desktopMeta.width || !desktopMeta.height) throw new Error('Could not read desktop emblem dimensions')

let masterPngDesktop
if (desktopSourcePath === emblemDesktopPng) {
  /* Alternate desktop master: square cover resize + circular alpha (drops square matte).
     Inset the mask ~2px so the disc does not sit exactly on the canvas edge (cleaner alpha). */
  const cx = SIZE / 2
  const r = SIZE / 2 - 2
  const circleMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><circle cx="${cx}" cy="${cx}" r="${r}" fill="#fff"/></svg>`
  )
  masterPngDesktop = await sharp(desktopSourcePath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
} else {
  /* Default emblem: opaque square tile — avoids shell quirks with mostly-transparent ICOs. */
  const desktopCrop = cropSquare(desktopMeta, DESKTOP_CROP_FRAC)
  masterPngDesktop = await sharp(desktopSourcePath)
    .extract({ left: desktopCrop.left, top: desktopCrop.top, width: desktopCrop.side, height: desktopCrop.side })
    .resize(SIZE, SIZE)
    .png()
    .toBuffer()
}

const webCrop = cropSquare(meta, WEB_CROP_FRAC)

const masterPngWeb = await sharp(emblemPng)
  .extract({ left: webCrop.left, top: webCrop.top, width: webCrop.side, height: webCrop.side })
  .resize(SIZE, SIZE)
  .png()
  .toBuffer()

await writeFileRobust(apple180, await sharp(masterPngWeb).resize(180, 180).png().toBuffer())

const iconPng = join(buildDir, 'icon.png')
const iconIco = join(buildDir, 'icon.ico')
const iconIcns = join(buildDir, 'icon.icns')

await writeFileRobust(iconPng, masterPngDesktop)

/* All-PNG ICO (PNG=true, forWinExe=false). The WinExe mix embeds 16–48px as BMP + XOR mask;
   that path often glitches semi-transparent / circular RGBA icons on Windows 10/11 shortcuts
   (blue X, bad fringe). File Properties on legacy Windows may look odd; shortcuts render correctly. */
const ico = png2icons.createICO(masterPngDesktop, png2icons.BICUBIC, 0, true, false)
if (!ico) throw new Error('png2icons.createICO returned null')
await writeFileRobust(iconIco, ico)

const icns = png2icons.createICNS(masterPngDesktop, png2icons.BICUBIC, 0)
if (!icns) throw new Error('png2icons.createICNS returned null')
await writeFileRobust(iconIcns, icns)

/* Web app manifest / install: raster from same opaque master as desktop (readable on home screens). */
const web192 = join(root, 'public', 'icon-192.png')
const web512 = join(root, 'public', 'icon-512.png')
const web512Maskable = join(root, 'public', 'icon-512-maskable.png')
await writeFileRobust(web192, await sharp(masterPngWeb).resize(192, 192).png().toBuffer())
await writeFileRobust(web512, await sharp(masterPngWeb).resize(512, 512).png().toBuffer())
/* Maskable safe zone ~72% emblem on parchment field (Android adaptive icon). */
const maskSide = 512
const inner = Math.round(maskSide * 0.72)
const pad = Math.floor((maskSide - inner) / 2)
const innerBuf = await sharp(masterPngWeb).resize(inner, inner).png().toBuffer()
await writeFileRobust(
  web512Maskable,
  await sharp({
    create: {
      width: maskSide,
      height: maskSide,
      channels: 4,
      background: { r: 248, g: 241, b: 227, alpha: 1 },
    },
  })
    .composite([{ input: innerBuf, left: pad, top: pad }])
    .png()
    .toBuffer()
)

console.log('Wrote', apple180)
console.log('Wrote', iconPng, iconIco, iconIcns)
console.log('Wrote', web192, web512, web512Maskable)

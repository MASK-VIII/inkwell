import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import png2icons from 'png2icons'

/**
 * Web favicon assets are rasterized from the simple SVG mark.
 * Desktop app/installer assets are rasterized from the gold-quill emblem
 * (`public/brand/inkwell-emblem.png`), center-cropped to match the in-app
 * emblem. Output is **opaque** (no circular alpha): Windows often fails to
 * render transparent regions on desktop shortcut / shell icons.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const faviconSvg = join(root, 'public', 'favicon.svg')
const emblemPng = join(root, 'public', 'brand', 'inkwell-emblem.png')
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
function cropSquare(cropFrac) {
  const side = Math.round(Math.min(meta.width, meta.height) * cropFrac)
  const left = Math.round((meta.width - side) / 2)
  const topRaw = Math.round((meta.height - side) / 2 + meta.height * yBiasFrac)
  const top = Math.max(0, Math.min(topRaw, meta.height - side))
  return { left, top, side }
}

/* Opaque master only — do not apply a circular alpha mask for .ico: Explorer
   and NSIS desktop shortcuts often show a wrong/empty icon when the embedded
   image is mostly transparent. Corners keep the source artwork (dark field). */
const desktopCrop = cropSquare(DESKTOP_CROP_FRAC)
const webCrop = cropSquare(WEB_CROP_FRAC)

const masterPngDesktop = await sharp(emblemPng)
  .extract({ left: desktopCrop.left, top: desktopCrop.top, width: desktopCrop.side, height: desktopCrop.side })
  .resize(SIZE, SIZE)
  .png()
  .toBuffer()

const masterPngWeb = await sharp(emblemPng)
  .extract({ left: webCrop.left, top: webCrop.top, width: webCrop.side, height: webCrop.side })
  .resize(SIZE, SIZE)
  .png()
  .toBuffer()

await sharp(masterPngWeb).resize(180, 180).png().toFile(apple180)

const iconPng = join(buildDir, 'icon.png')
const iconIco = join(buildDir, 'icon.ico')
const iconIcns = join(buildDir, 'icon.icns')

await writeFile(iconPng, masterPngDesktop)

/* forWinExe=true: stores small sizes as BMP (compatible with the file
   properties dialog of older Windows) while keeping large sizes as PNG.
   numOfColors=0 = lossless. */
const ico = png2icons.createICO(masterPngDesktop, png2icons.BICUBIC, 0, false, true)
if (!ico) throw new Error('png2icons.createICO returned null')
await writeFile(iconIco, ico)

const icns = png2icons.createICNS(masterPngDesktop, png2icons.BICUBIC, 0)
if (!icns) throw new Error('png2icons.createICNS returned null')
await writeFile(iconIcns, icns)

/* Web app manifest / install: raster from same opaque master as desktop (readable on home screens). */
const web192 = join(root, 'public', 'icon-192.png')
const web512 = join(root, 'public', 'icon-512.png')
const web512Maskable = join(root, 'public', 'icon-512-maskable.png')
await sharp(masterPngWeb).resize(192, 192).png().toFile(web192)
await sharp(masterPngWeb).resize(512, 512).png().toFile(web512)
/* Maskable safe zone ~72% emblem on parchment field (Android adaptive icon). */
const maskSide = 512
const inner = Math.round(maskSide * 0.72)
const pad = Math.floor((maskSide - inner) / 2)
const innerBuf = await sharp(masterPngWeb).resize(inner, inner).png().toBuffer()
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
  .toFile(web512Maskable)

console.log('Wrote', apple180)
console.log('Wrote', iconPng, iconIco, iconIcns)
console.log('Wrote', web192, web512, web512Maskable)

import JSZip from 'jszip'
import type { InkwellProject } from '../../types'
import { CHAPTER_TITLE_STYLES } from '../../types'
import type { ManuscriptSectionRole } from '../../types'
import {
  displayChapterLabel,
  effectiveSectionRole,
  layoutProfileForManuscript,
  manuscriptsForEpub,
} from '../bookAssembly'
import { ebookCss, resolveEbookTitleFontId } from '../ebook/ebookCss'
import { tiptapDocToXhtmlBody } from '../ebook/tiptapRender'
import { DEFAULT_BODY_FONT_ID, FONT_CATALOG, isInkwellFontId } from '../fonts/fontCatalog'
import { getPrintFontBytes } from '../print/fonts'

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'book'
  )
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function epubFontMediaType(filename: string): string {
  if (filename.endsWith('.woff2')) return 'font/woff2'
  if (filename.endsWith('.woff')) return 'font/woff'
  return 'font/ttf'
}

function decodeCoverAsset(dataUrl: string): { bytes: Uint8Array; href: string; mediaType: string } | null {
  const m = /^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl.trim())
  if (!m?.[2]) return null
  const mimeRaw = m[1].toLowerCase()
  const mediaType = mimeRaw.endsWith('png') ? 'image/png' : 'image/jpeg'
  const href = mediaType === 'image/png' ? 'images/cover.png' : 'images/cover.jpg'
  try {
    const bin = atob(m[2])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { bytes, href, mediaType }
  } catch {
    return null
  }
}

function epubTypeAttrForRole(role: ManuscriptSectionRole): string {
  switch (role) {
    case 'copyright':
      return 'copyright'
    case 'dedication':
      return 'dedication'
    case 'epigraph':
      return 'epigraph'
    case 'foreword':
      return 'foreword'
    case 'preface':
      return 'preface'
    case 'introduction':
      return 'introduction'
    case 'acknowledgments':
      return 'acknowledgments'
    case 'toc':
      return 'toc'
    case 'title_page':
      return 'titlepage'
    default:
      return ''
  }
}

export async function buildEpub(project: InkwellProject): Promise<Uint8Array> {
  const zip = new JSZip()

  // Must be first and uncompressed per spec.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  zip.folder('META-INF')?.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  )

  const oebps = zip.folder('OEBPS')!

  const ebookTheme = project.theme.ebook
  const bodyFontId = isInkwellFontId(ebookTheme.bodyFontId) ? ebookTheme.bodyFontId : DEFAULT_BODY_FONT_ID
  const fontRow = FONT_CATALOG[bodyFontId]
  const embedFont = ebookTheme.embedFontsInEpub !== false
  let bundledFontHref: string | undefined
  if (embedFont) {
    const bytes = await getPrintFontBytes(bodyFontId)
    oebps.folder('fonts')?.file(fontRow.epubFilename, bytes)
    bundledFontHref = `../fonts/${fontRow.epubFilename}`
  }

  // Resolve and (optionally) embed the chapter title font when distinct.
  const titleFontId = resolveEbookTitleFontId(ebookTheme)
  const titleFontRow = FONT_CATALOG[titleFontId]
  const titleFontDistinct = titleFontId !== bodyFontId
  let bundledTitleFontHref: string | undefined
  let bundledTitleFontFilename: string | undefined
  if (embedFont && titleFontDistinct) {
    const bytes = await getPrintFontBytes(titleFontId)
    oebps.folder('fonts')?.file(titleFontRow.epubFilename, bytes)
    bundledTitleFontHref = `../fonts/${titleFontRow.epubFilename}`
    bundledTitleFontFilename = titleFontRow.epubFilename
  }

  oebps
    .folder('styles')
    ?.file(
      'book.css',
      ebookCss(ebookTheme, {
        kind: 'epub',
        embedFont,
        bundledFontHref,
        bundledTitleFontHref,
        bundledTitleFontFilename,
      }),
    )

  const chaptersFolder = oebps.folder('chapters')!

  const title = project.book.title?.trim() || project.chapters[0]?.title || 'Untitled'
  const author = project.book.authorName?.trim() || 'Unknown'
  const lang = project.book.language?.trim() || 'en'
  const bookId = project.book.isbn?.trim() || `urn:uuid:${project.id}`
  const modifiedIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const coverAsset = project.book.coverImageDataUrl ?
    decodeCoverAsset(project.book.coverImageDataUrl)
  : null
  if (coverAsset) {
    oebps.folder('images')?.file(coverAsset.href.replace(/^images\//, ''), coverAsset.bytes)
  }

  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles/book.css" media-type="text/css"/>`,
  ]
  if (coverAsset) {
    manifestItems.push(
      `<item id="cover-image" href="${escXml(coverAsset.href)}" media-type="${coverAsset.mediaType}" properties="cover-image"/>`,
    )
  }
  if (embedFont) {
    const mt = epubFontMediaType(fontRow.epubFilename)
    const props =
      mt === 'font/woff2' ? ` properties="font/woff2"` : mt === 'font/woff' ? ` properties="font/woff"` : ''
    manifestItems.push(
      `<item id="inkwell-body-font" href="fonts/${fontRow.epubFilename}" media-type="${mt}"${props}/>`,
    )
    if (titleFontDistinct) {
      const tmt = epubFontMediaType(titleFontRow.epubFilename)
      const tprops =
        tmt === 'font/woff2'
          ? ` properties="font/woff2"`
          : tmt === 'font/woff'
            ? ` properties="font/woff"`
            : ''
      manifestItems.push(
        `<item id="inkwell-title-font" href="fonts/${titleFontRow.epubFilename}" media-type="${tmt}"${tprops}/>`,
      )
    }
  }
  const spineItems: string[] = []
  const navLi: string[] = []

  const titleSpec = CHAPTER_TITLE_STYLES[ebookTheme.chapterTitleStyleId]
  const ornamentMarkup =
    titleSpec.ornamentBelow
      ? `\n      <div class="inkwell-ch-ornament" aria-hidden="true">${escXml(titleSpec.ornamentBelow)}</div>`
      : ''

  const epubChapters = manuscriptsForEpub(project)
  let bodyChapterCount = 0
  epubChapters.forEach((ch, i) => {
    const n = i + 1
    const id = `c${n}`
    const href = `chapters/${id}.xhtml`
    const role = effectiveSectionRole(ch)
    const layout = layoutProfileForManuscript(ch)
    if (role === 'chapter') bodyChapterCount += 1
    const chapterTitle =
      role === 'chapter'
        ? displayChapterLabel(project, ch, bodyChapterCount)
        : ch.title?.trim() || `Section ${n}`

    const body = tiptapDocToXhtmlBody(ch.content)
    const epubType = epubTypeAttrForRole(role)
    const epubTypeAttr =
      epubType && layout !== 'chapter' && layout !== 'part' ? ` epub:type="${escXml(epubType)}"` : ''
    const sectionInner =
      layout === 'chapter' || layout === 'part' ?
        `<section class="${layout === 'part' ? 'chapter part' : 'chapter'}" aria-label="${escXml(chapterTitle)}">
      <h1>${escXml(chapterTitle)}</h1>${ornamentMarkup}
      ${body}
    </section>`
      : `<section class="inkwell-matter matter-${escXml(role)}" aria-label="${escXml(chapterTitle)}"${epubTypeAttr}>
      ${body}
    </section>`
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escXml(lang)}" lang="${escXml(lang)}">
  <head>
    <meta charset="utf-8" />
    <title>${escXml(chapterTitle)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/book.css" />
  </head>
  <body>
    ${sectionInner}
  </body>
</html>`

    chaptersFolder.file(`${id}.xhtml`, xhtml)
    manifestItems.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`)
    spineItems.push(`<itemref idref="${id}"/>`)
    navLi.push(`<li><a href="${href}">${escXml(chapterTitle)}</a></li>`)
  })

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escXml(lang)}" lang="${escXml(lang)}">
  <head>
    <meta charset="utf-8" />
    <title>Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="styles/book.css" />
  </head>
  <body>
    <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops" id="toc">
      <h1>Contents</h1>
      <ol>
        ${navLi.join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`
  oebps.file('nav.xhtml', nav)

  const seriesBlock = (() => {
    if (!project.book.series?.trim()) return ''
    const s = escXml(project.book.series.trim())
    let b = `\n    <meta property="belongs-to-collection" id="cid">${s}</meta>`
    if (project.book.seriesIndex != null && Number.isFinite(project.book.seriesIndex)) {
      b += `\n    <meta refines="#cid" property="collection-type">series</meta>\n    <meta refines="#cid" property="group-position">${escXml(String(project.book.seriesIndex))}</meta>`
    }
    return b
  })()
  const desc =
    project.book.description?.trim() ?
      `\n    <dc:description>${escXml(project.book.description.trim())}</dc:description>`
    : ''
  const pub =
    project.book.publisher?.trim() ?
      `\n    <dc:publisher>${escXml(project.book.publisher.trim())}</dc:publisher>`
    : ''

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${escXml(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escXml(bookId)}</dc:identifier>
    <dc:title>${escXml(title)}</dc:title>
    <dc:language>${escXml(lang)}</dc:language>
    <dc:creator>${escXml(author)}</dc:creator>${desc}${pub}${seriesBlock}
    <meta property="dcterms:modified">${escXml(modifiedIso)}</meta>${
      coverAsset ?
        `\n    <meta name="cover" content="cover-image"/>`
      : ''
    }
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`
  oebps.file('content.opf', contentOpf)

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
  return bytes
}

export function epubFilename(project: InkwellProject): string {
  const t = project.book.title?.trim() || project.chapters[0]?.title || 'book'
  return `${slug(t)}.epub`
}


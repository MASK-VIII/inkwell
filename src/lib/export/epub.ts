import JSZip from 'jszip'
import type { InkwellProject } from '../../types'
import {
  displayChapterLabel,
  effectiveSectionRole,
  manuscriptsForEpub,
} from '../bookAssembly'
import { ebookCss } from '../ebook/ebookCss'
import { tiptapDocToXhtmlBody } from '../ebook/tiptapRender'

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
  oebps.folder('styles')?.file('book.css', ebookCss(project.theme.ebook))

  const chaptersFolder = oebps.folder('chapters')!

  const title = project.book.title?.trim() || project.chapters[0]?.title || 'Untitled'
  const author = project.book.authorName?.trim() || 'Unknown'
  const lang = project.book.language?.trim() || 'en'
  const bookId = project.book.isbn?.trim() || `urn:uuid:${project.id}`

  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles/book.css" media-type="text/css"/>`,
  ]
  const spineItems: string[] = []
  const navLi: string[] = []

  const epubChapters = manuscriptsForEpub(project)
  let bodyChapterCount = 0
  epubChapters.forEach((ch, i) => {
    const n = i + 1
    const id = `c${n}`
    const href = `chapters/${id}.xhtml`
    const role = effectiveSectionRole(ch)
    if (role === 'chapter') bodyChapterCount += 1
    const chapterTitle =
      role === 'chapter'
        ? displayChapterLabel(project, ch, bodyChapterCount)
        : ch.title?.trim() || `Section ${n}`

    const body = tiptapDocToXhtmlBody(ch.content)
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escXml(lang)}" lang="${escXml(lang)}">
  <head>
    <meta charset="utf-8" />
    <title>${escXml(chapterTitle)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/book.css" />
  </head>
  <body>
    <section class="chapter" aria-label="${escXml(chapterTitle)}">
      <h1>${escXml(chapterTitle)}</h1>
      ${body}
    </section>
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
    <meta property="dcterms:modified">2000-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`
  oebps.file('content.opf', contentOpf)

  // Deterministic-ish: JSZip won't embed timestamps unless asked; we also keep modified meta fixed.
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


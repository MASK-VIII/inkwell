import JSZip from 'jszip'
import type { JSONContent } from '@tiptap/core'
import type { InkwellProject } from '../../types'
import { displayChapterLabel, effectiveSectionRole, manuscriptsForEpub } from '../bookAssembly'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'book'
  )
}

export function docxFilename(project: InkwellProject): string {
  const t = project.book.title?.trim() || project.chapters[0]?.title || 'book'
  return `${slug(t)}.docx`
}

type NumKind = 'bullet' | 'ordered'

/** OOXML paragraphs (inner XML fragments, no wrapper). */
type EmitCtx = {
  parts: string[]
  /** Running footnote index within current chapter (reset per chapter). */
  fnChapter: { list: { content: string }[] }
}

const ctxStack: EmitCtx[] = []

function ctxStackTop(): EmitCtx {
  const c = ctxStack[ctxStack.length - 1]
  if (!c) throw new Error('docx emit: missing ctx')
  return c
}

function runProps(opts: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  superscript?: boolean
}): string {
  if (!opts.bold && !opts.italic && !opts.underline && !opts.strike && !opts.superscript) return ''
  let inner = ''
  if (opts.bold) inner += '<w:b/>'
  if (opts.italic) inner += '<w:i/>'
  if (opts.underline) inner += '<w:u w:val="single"/>'
  if (opts.strike) inner += '<w:strike/>'
  if (opts.superscript) inner += '<w:vertAlign w:val="superscript"/>'
  return `<w:rPr>${inner}</w:rPr>`
}

function textRun(text: string, rPr?: string): string {
  const safe = esc(text)
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ''
  return `<w:r>${rPr ?? ''}<w:t${preserve}>${safe}</w:t></w:r>`
}

function mergeMarks(
  marks: { type: string }[] | undefined,
): { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean } {
  if (!marks?.length) return {}
  const types = new Set(marks.map((m) => m.type))
  return {
    bold: types.has('bold'),
    italic: types.has('italic'),
    underline: types.has('underline'),
    strike: types.has('strike'),
  }
}

function emitInline(nodes: JSONContent[] | undefined, out: string[]): void {
  if (!nodes) return
  for (const node of nodes) {
    if (node.type === 'text') {
      const t = node.text ?? ''
      if (!t) continue
      const m = mergeMarks(node.marks as { type: string }[] | undefined)
      const fn = node.marks?.find((x) => x.type === 'writerFootnote') as
        | { type: string; attrs?: { id?: string; content?: string } }
        | undefined
      if (fn?.attrs?.content != null && fn.attrs.content !== '') {
        ctxStackTop().fnChapter.list.push({ content: String(fn.attrs.content) })
        const marker = t.trim() || String(ctxStackTop().fnChapter.list.length)
        out.push(textRun(marker, runProps({ ...m, superscript: true })))
        continue
      }
      out.push(textRun(t, runProps(m)))
    } else if (node.type === 'hardBreak') {
      out.push('<w:r><w:br/></w:r>')
    } else if (node.type === 'mention') {
      const label =
        String((node.attrs as { label?: string; id?: string } | undefined)?.label ??
          (node.attrs as { id?: string } | undefined)?.id ??
          '')
      out.push(textRun(label ? `@${label}` : '@'))
    } else if (node.content) {
      emitInline(node.content, out)
    }
  }
}

function paragraphInnerFromContent(content: JSONContent[] | undefined): string {
  const runs: string[] = []
  emitInline(content, runs)
  if (runs.length === 0) runs.push('<w:r><w:t></w:t></w:r>')
  return runs.join('')
}

function emitParagraph(node: JSONContent, numPr?: string): void {
  const align = (node.attrs as { textAlign?: string } | undefined)?.textAlign
  const jc =
    align === 'center' ? '<w:jc w:val="center"/>' : align === 'right' ? '<w:jc w:val="right"/>' : ''
  const pPrExtra = [numPr ? `<w:pPr>${numPr}${jc ? jc : ''}</w:pPr>` : jc ? `<w:pPr>${jc}</w:pPr>` : ''].join('')
  const inner = paragraphInnerFromContent(node.content)
  ctxStackTop().parts.push(`<w:p>${pPrExtra}${inner}</w:p>`)
}

function emitHeading(level: 1 | 2 | 3, node: JSONContent): void {
  const style = level === 1 ? 'Heading1' : level === 2 ? 'Heading2' : 'Heading3'
  const inner = paragraphInnerFromContent(node.content)
  ctxStackTop().parts.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inner}</w:p>`)
}

function emitPageBreakPara(): void {
  ctxStackTop().parts.push(
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
  )
}

function emitSceneBreak(ornament: string): void {
  const text = ornament.trim() || '✦'
  ctxStackTop().parts.push(
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textRun(text)}</w:p>`,
  )
}

function emitBlockquote(blocks: JSONContent[]): void {
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      const inner = paragraphInnerFromContent(b.content)
      ctxStackTop().parts.push(
        `<w:p><w:pPr><w:ind w:left="720"/></w:pPr>${inner}</w:p>`,
      )
    } else {
      emitBlock(b)
    }
  }
}

function numPrFor(kind: NumKind, ilvl: number): string {
  const numId = kind === 'bullet' ? '1' : '2'
  return `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`
}

function emitList(node: JSONContent, kind: NumKind, ilvl: number): void {
  const items = node.content ?? []
  for (const item of items) {
    if (item.type !== 'listItem') continue
    const body = item.content ?? []
    let first = true
    for (const child of body) {
      if (child.type === 'bulletList') {
        emitList(child, 'bullet', ilvl + 1)
        first = false
      } else if (child.type === 'orderedList') {
        emitList(child, 'ordered', ilvl + 1)
        first = false
      } else if (child.type === 'paragraph') {
        const inner = paragraphInnerFromContent(child.content)
        const np = first ? numPrFor(kind, ilvl) : ''
        first = false
        const pPr = np ? `<w:pPr>${np}</w:pPr>` : ''
        ctxStackTop().parts.push(`<w:p>${pPr}${inner}</w:p>`)
      } else {
        emitBlock(child)
        first = false
      }
    }
  }
}

function emitImagePlaceholder(node: JSONContent): void {
  const alt = String((node.attrs as { alt?: string } | undefined)?.alt ?? 'Image').trim() || 'Image'
  emitParagraph({
    type: 'paragraph',
    content: [{ type: 'text', text: `[Image: ${alt}]` }],
  })
}

function emitBlock(node: JSONContent): void {
  switch (node.type) {
    case 'paragraph':
      emitParagraph(node)
      break
    case 'heading': {
      const raw = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
      const level = (raw === 2 ? 2 : raw === 3 ? 3 : 1) as 1 | 2 | 3
      emitHeading(level, node)
      break
    }
    case 'bulletList':
      emitList(node, 'bullet', 0)
      break
    case 'orderedList':
      emitList(node, 'ordered', 0)
      break
    case 'blockquote':
      emitBlockquote(node.content ?? [])
      break
    case 'horizontalRule': {
      const orn = String((node.attrs as { ornament?: string } | undefined)?.ornament ?? '').trim()
      emitSceneBreak(orn || '✦')
      break
    }
    case 'pageBreak':
      emitPageBreakPara()
      break
    case 'image':
      emitImagePlaceholder(node)
      break
    default:
      if (node.content) {
        for (const c of node.content) emitBlock(c)
      }
      break
  }
}

function emitDocBody(doc: JSONContent): string[] {
  const ctx: EmitCtx = { parts: [], fnChapter: { list: [] } }
  ctxStack.push(ctx)
  try {
    const blocks = doc.content ?? []
    for (const b of blocks) emitBlock(b)

    if (ctx.fnChapter.list.length > 0) {
      ctx.parts.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${textRun('Notes')}</w:p>`,
      )
      let i = 1
      for (const fn of ctx.fnChapter.list) {
        const inner = paragraphInnerFromContent([{ type: 'text', text: fn.content }])
        ctx.parts.push(`<w:p>${textRun(`${i}. `)}${inner}</w:p>`)
        i++
      }
    }
    return ctx.parts
  } finally {
    ctxStack.pop()
  }
}

function documentXmlForChapter(title: string, doc: JSONContent): string {
  const bodyParts = emitDocBody(doc)
  const titlePara = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${textRun(title)}</w:p>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${titlePara}
    ${bodyParts.join('\n')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
}

function documentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`
}

function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`
}

function coreXml(title: string, author: string): string {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(title)}</dc:title>
  <dc:creator>${esc(author)}</dc:creator>
  <cp:lastModifiedBy>Inkwell</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

function singleChapterDocXml(title: string, doc: JSONContent): string {
  return documentXmlForChapter(title, doc)
}

/** Merge multiple chapters into one document body (page breaks between). */
function mergedDocumentXml(chapters: { title: string; content: JSONContent }[]): string {
  const pieces: string[] = []
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!
    const ctx: EmitCtx = { parts: [], fnChapter: { list: [] } }
    ctxStack.push(ctx)
    try {
      ctx.parts.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${textRun(ch.title)}</w:p>`,
      )
      const blocks = ch.content.content ?? []
      for (const b of blocks) emitBlock(b)
      if (ctx.fnChapter.list.length > 0) {
        ctx.parts.push(
          `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${textRun('Notes')}</w:p>`,
        )
        let j = 1
        for (const fn of ctx.fnChapter.list) {
          const inner = paragraphInnerFromContent([{ type: 'text', text: fn.content }])
          ctx.parts.push(`<w:p>${textRun(`${j}. `)}${inner}</w:p>`)
          j++
        }
      }
      pieces.push(...ctx.parts)
    } finally {
      ctxStack.pop()
    }
    if (i < chapters.length - 1) {
      pieces.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${pieces.join('\n')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`
}

export async function buildDocx(project: InkwellProject): Promise<Uint8Array> {
  const spine = manuscriptsForEpub(project)
  let bodyChapterCount = 0
  const chapters: { title: string; content: JSONContent }[] = []
  for (const m of spine) {
    const role = effectiveSectionRole(m)
    if (role === 'chapter') bodyChapterCount += 1
    const title =
      role === 'chapter' ?
        displayChapterLabel(project, m, bodyChapterCount)
      : m.title?.trim() || 'Section'
    chapters.push({
      title,
      content: m.content?.type === 'doc' ? m.content : { type: 'doc', content: [] },
    })
  }

  const docXml =
    chapters.length === 0 ?
      singleChapterDocXml('Untitled', { type: 'doc', content: [{ type: 'paragraph' }] })
    : chapters.length === 1 ?
      singleChapterDocXml(chapters[0]!.title, chapters[0]!.content)
    : mergedDocumentXml(chapters)

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml())
  zip.folder('_rels')?.file('.rels', rootRelsXml())
  zip.folder('docProps')?.file('core.xml', coreXml(project.book.title || 'Untitled', project.book.authorName || ''))
  const word = zip.folder('word')!
  word.file('document.xml', docXml)
  word.file('styles.xml', stylesXml())
  word.file('numbering.xml', numberingXml())
  word.folder('_rels')?.file('document.xml.rels', documentRelsXml())

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return bytes
}

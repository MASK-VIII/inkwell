# Print / PDF vs ebook parity matrix

Single source for marks: [`src/lib/tiptap/inlineMarks.ts`](../src/lib/tiptap/inlineMarks.ts) (`inlineStyleFromMarks`, `markTypesBold` / `markTypesItalic` for HTML tag order).

| Feature | Ebook path | Print / PDF path | Parity notes |
|--------|------------|------------------|--------------|
| Paragraph | `tiptapRender` → `<p>` + `ebookCss` | `extractPrintBlocks` → `paginate` → lines | Drop cap / text-align: EPUB has CSS; print ignores align unless added later. |
| Heading 1–3 | `<h1>`–`<h3>` | `PrintBlock` heading → layout | Same levels; print adds chapter opener / scene-break roles. |
| Bold / strong / b | `<strong>` via `markTypesBold` | `PrintTextRun.bold` + PDF fonts | Aligned via `inlineMarks`. |
| Italic / em / i | `<em>` | `PrintTextRun.italic` | Aligned. |
| Underline | `<u>` | `PrintTextRun.underline` + PDF line | Aligned. |
| Strike | `<s>` | `PrintTextRun.strike` → `PrintLineTextRun.strike` → PDF line + preview `line-through` | Parity (see `inlineMarks.marksIndicateStrike`). |
| Link | `<a href>` sanitized | Plain text in print (URL not shown) | Intentional for fixed layout; document for authors. |
| Footnote | `<sup>` + endnotes section | Collected as “Notes” block at end of chapter | Different UX; content preserved. |
| Writer comment | `<mark>` export | Stripped in print extract | Optional future: omit or margin note. |
| Mention | `<span class="inkwell-mention-export">` | `@label` text in runs | Plain text in print/PDF. |
| Hard break | `<br />` | Space in runs (line break behavior) | Layout differs; acceptable. |
| Bullet / ordered list | `<ul>` / `<ol>` / `<li>` | Paragraph + `listPrefix` / `listIndentPt` | Aligned semantically. |
| Blockquote | `<blockquote>` | `blockquote: true` on paragraphs | Aligned. |
| Horizontal rule / scene break | `<hr>` or ornament `<p>` | Heading `sceneBreak` | Aligned. |
| Page break | stripped in XHTML | `pageBreak` block | Print-only. |
| Image | `<figure><img>` | `figure` block + raster in PDF | EPUB allows webp/avif in sanitizer; PDF embed PNG/JPEG only — may fallback to alt text. |
| Chapter title style | `ebookCss` + `CHAPTER_TITLE_STYLES` | `buildChapterOpenerBlocks` + title font in PDF | Font policy: `resolveEbookTitleFontId` vs `resolvePrintTitleFontId` should stay in sync per preset. |

## Gaps to track

1. **Link** URLs not in print body (by design); TOC / back matter links are separate.
2. **Image formats**: EPUB sanitizer allows more MIME types than `pdfKdp` `tryEmbedRaster` — extend PDF embed or normalize on insert.
3. **Paragraph text-align / drop cap**: ebook-only until print layout supports them.

## Layout invalidation keys

[`computePrintLayoutBasisParts`](../src/lib/print/printLayoutBasis.ts) exposes `contentKey`, `themeKey`, `assemblyKey`, and `bookMetaKey` plus `combinedKey` (same string as `computePrintLayoutBasisKey`). Preview and PDF cache still key off `combinedKey`; finer keys are for future incremental invalidation.

## Live full-spine preview

[`paginatePrintSpine`](../src/workers/render.worker.ts) runs `paginateSpineWithFont` with `onChapterComplete`, posting `printSpinePagesProgress` after each manuscript so [`PrintReview`](../src/components/PrintReview.tsx) can merge partial `chapterPages` before the final `printSpinePagesResult`.

## Fingerprinting (layout invalidation)

See [`src/lib/print/printLayoutBasis.ts`](../src/lib/print/printLayoutBasis.ts):

- `contentKey` — manuscript JSON + titles + assembly TOC flags + book meta strings.
- `themeKey` — serialized `theme.print`.
- `assemblyKey` — assembly fields without full chapter bodies (for future optimizations).
- `layoutBasisKey` — `contentKey|themeKey` (combined), used for PDF cache and preview epoch.

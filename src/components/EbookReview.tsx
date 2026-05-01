import type { JSONContent } from '@tiptap/core'
import { useMemo, useState, type ReactNode } from 'react'
import type { EbookTheme, Manuscript } from '../types'
import { ebookCss } from '../lib/ebook/ebookCss'

type Props = {
  chapters: Manuscript[]
  theme: { ebook: EbookTheme }
  onJumpToChapter: (id: number) => void
}

function marksToWrap(
  node: JSONContent,
  child: ReactNode,
): ReactNode {
  const marks = (node.marks as { type: string }[] | undefined) ?? []
  const types = new Set(marks.map((m) => m.type))
  let out: ReactNode = child
  if (types.has('underline')) out = <u>{out}</u>
  if (types.has('italic')) out = <em>{out}</em>
  if (types.has('bold')) out = <strong>{out}</strong>
  return out
}

function renderInline(node: JSONContent, key: string): ReactNode {
  if (node.type === 'text') {
    const t = node.text ?? ''
    return <span key={key}>{marksToWrap(node, t)}</span>
  }
  if (node.type === 'hardBreak') return <br key={key} />
  return null
}

function renderBlock(node: JSONContent, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p key={key}>
          {(node.content ?? []).map((n, i) => renderInline(n, `${key}_i${i}`))}
        </p>
      )
    case 'heading': {
      const level = (node.attrs as { level?: number } | undefined)?.level ?? 2
      const kids = (node.content ?? []).map((n, i) => renderInline(n, `${key}_i${i}`))
      if (level === 1) return <h1 key={key}>{kids}</h1>
      if (level === 2) return <h2 key={key}>{kids}</h2>
      return <h3 key={key}>{kids}</h3>
    }
    case 'bulletList':
      return (
        <ul key={key}>
          {(node.content ?? []).map((n, i) => renderBlock(n, `${key}_b${i}`))}
        </ul>
      )
    case 'orderedList':
      return (
        <ol key={key}>
          {(node.content ?? []).map((n, i) => renderBlock(n, `${key}_o${i}`))}
        </ol>
      )
    case 'listItem':
      return <li key={key}>{(node.content ?? []).map((n, i) => renderBlock(n, `${key}_li${i}`))}</li>
    case 'blockquote':
      return <blockquote key={key}>{(node.content ?? []).map((n, i) => renderBlock(n, `${key}_q${i}`))}</blockquote>
    case 'horizontalRule':
      return <hr key={key} />
    case 'pageBreak':
      // Ignore (ebook is reflow).
      return null
    default:
      if (node.content?.length) {
        return <div key={key}>{(node.content ?? []).map((n, i) => renderBlock(n, `${key}_d${i}`))}</div>
      }
      return null
  }
}

export function EbookReview({ chapters, theme, onJumpToChapter }: Props) {
  const [device, setDevice] = useState<'phone' | 'tablet' | 'ereader'>(() => 'ereader')

  const css = useMemo(() => ebookCss(theme.ebook), [theme.ebook])

  const width =
    device === 'phone' ? 360 : device === 'tablet' ? 640 : 460

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dust bg-white/60 px-4 py-3 dark:border-border-dark dark:bg-panel-dark/60 sm:px-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
          Review: Ebook
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Device
          </label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as typeof device)}
            className="rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm font-medium text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
          >
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="ereader">E-reader</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-auto p-6 sm:p-10">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
          <div
            className="mx-auto overflow-hidden rounded-[2rem] border border-dust bg-white shadow-xl dark:border-border-dark dark:bg-black/10"
            style={{ width }}
          >
            <style>{css}</style>
            <div className="inkwell-ebook-preview">
              <div className="chapter py-6">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onJumpToChapter(ch.id)}
                  className="w-full text-left hover:bg-dust/20 dark:hover:bg-border-dark/30"
                  title="Jump to this chapter in Write mode"
                >
                  <div className="px-4 py-4">
                    <h1 className="m-0">{ch.title || 'Untitled chapter'}</h1>
                    <div className="mt-3">
                      {(ch.content?.content ?? []).map((n, i) => renderBlock(n, `${ch.id}_${i}`))}
                    </div>
                  </div>
                </button>
              ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-xl text-center text-xs text-ink/60 dark:text-ink-dark/60">
            This is a reflow preview. Real EPUB readers may differ in fonts and pagination.
          </div>
        </div>
      </div>
    </div>
  )
}


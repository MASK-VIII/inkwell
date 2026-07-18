import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type GuideDef = {
  slug: string
  title: string
  description: string
  /** ISO date YYYY-MM-DD for Article JSON-LD */
  dateModified: string
  Body: LazyExoticComponent<ComponentType>
}

function laz(importFn: () => Promise<{ default: ComponentType }>): LazyExoticComponent<ComponentType> {
  return lazy(importFn)
}

export const GUIDES: readonly GuideDef[] = [
  {
    slug: 'epub-kindle-kdp-checklist',
    title: 'EPUB checklist for Kindle and KDP-style digital publishing',
    description:
      'A practical checklist before you upload: validate early, preview on a phone, and avoid the usual EPUB surprises.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/EpubKindleKdpChecklist')),
  },
  {
    slug: 'docx-for-editors',
    title: 'Preparing a DOCX manuscript for editors and beta readers',
    description:
      'How to hand off a Word-friendly file that survives comments, track changes, and real editorial friction.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/DocxForEditors')),
  },
  {
    slug: 'print-pdf-self-publishing-basics',
    title: 'Print PDF basics for self-publishing (what actually breaks)',
    description:
      'Trim, bleed, margins, and cover resolution—short preflight habits that save print hours later.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/PrintPdfSelfPublishingBasics')),
  },
  {
    slug: 'local-first-writing-workflow',
    title: 'Why a local-first writing workflow still wins for novels',
    description:
      'Offline is not an edge case for long manuscripts—here is a simple map from draft to export without renting your attention span.',
    dateModified: '2026-07-17',
    Body: laz(() => import('./bodies/LocalFirstWritingWorkflow')),
  },
  {
    slug: 'one-time-vs-subscription-writing-tools',
    title: 'Free and one-time writing tools vs subscriptions: how to choose calmly',
    description:
      'When recurring tools make sense—and when free or local-first software matches long revision cycles.',
    dateModified: '2026-07-17',
    Body: laz(() => import('./bodies/OneTimeVsSubscriptionWritingTools')),
  },
  {
    slug: 'scrivener-alternative-novel-drafting',
    title: 'Binder-first novel drafting: what “Scrivener alternative” should mean',
    description:
      'Honest framing: match the arc you use—chapters, notes, exports—without pretending two apps are the same product.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/ScrivenerAlternativeNovelDrafting')),
  },
  {
    slug: 'cloud-backup-for-manuscripts',
    title: 'Backing up your manuscripts (without drama)',
    description:
      'What a library backup is for, how Inkwell packages your whole library as a portable archive, and habits that keep restores boring.',
    dateModified: '2026-07-17',
    Body: laz(() => import('./bodies/CloudBackupForManuscripts')),
  },
  {
    slug: 'export-anxiety',
    title: 'Export anxiety: smaller loops, safer milestones',
    description:
      'Make the scary step routine—preview earlier, export dated junk files, and let free exports turn milestones into practice.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/ExportAnxiety')),
  },
  {
    slug: 'chapter-first-outlining',
    title: 'Chapter-first outlining that does not stall your draft',
    description:
      'Keep the spine of the book in chapters and notes—light outlines that survive reordering and late rewrites.',
    dateModified: '2026-05-07',
    Body: laz(() => import('./bodies/ChapterFirstOutlining')),
  },
]

const bySlug = new Map(GUIDES.map((g) => [g.slug, g]))

export function getGuideBySlug(slug: string): GuideDef | undefined {
  return bySlug.get(slug)
}

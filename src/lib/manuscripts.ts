import type { JSONContent } from '@tiptap/core'
import type { InkwellProject, Manuscript, WritingGoals } from '../types'
import { defaultBookMeta, defaultWritingGoals } from '../types'
import { countWordsInDoc, todayLocalISODate } from './wordCount'

const STORAGE_KEY_V1 = 'inkwell-manuscripts-v1'
const STORAGE_KEY = 'inkwell-project-v2'

const sampleParagraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

export const defaultDoc = (placeholder: string): JSONContent => ({
  type: 'doc',
  content: [sampleParagraph(placeholder)],
})

const SAMPLE_CH1: JSONContent = {
  type: 'doc',
  content: [
    sampleParagraph(
      'The rain fell in silver threads against the windowpane of the old library.',
    ),
    sampleParagraph(
      'Elias watched the droplets race each other down the glass, each one carrying a story he would never read.',
    ),
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '“You write like the rain,” ', marks: [{ type: 'italic' }] },
        {
          type: 'text',
          text: 'the woman in the green coat had told him once. Sparse. Unforgiving. Beautiful in its refusal to explain itself.',
        },
      ],
    },
  ],
}

const SAMPLE_CH2: JSONContent = {
  type: 'doc',
  content: [
    sampleParagraph(
      'The shelves whispered their secrets as the lantern light danced across leather spines…',
    ),
  ],
}

function seedChapters(): Manuscript[] {
  return [
    {
      id: 1,
      title: 'Chapter 1 • The Shadowed Quill',
      content: SAMPLE_CH1,
    },
    {
      id: 2,
      title: 'Chapter 2 • The Forgotten Ink',
      content: SAMPLE_CH2,
    },
  ]
}

function seedProject(): InkwellProject {
  return withAlignedGoals({
    version: 2,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: seedChapters(),
  })
}

export function totalWordsInChapters(chapters: Manuscript[]): number {
  return chapters.reduce((sum, ch) => sum + countWordsInDoc(ch.content), 0)
}

/** Roll daily baseline when the local calendar day changes. */
export function alignGoalsToDate(goals: WritingGoals, totalBookWords: number): WritingGoals {
  const today = todayLocalISODate()
  if (goals.dailyProgressDate !== today) {
    return {
      ...goals,
      dailyProgressDate: today,
      dailyBaselineWordCount: totalBookWords,
    }
  }
  return goals
}

export function withAlignedGoals(project: InkwellProject): InkwellProject {
  const total = totalWordsInChapters(project.chapters)
  const goals = alignGoalsToDate(project.goals, total)
  return { ...project, goals }
}

function migrateV1Array(parsed: Manuscript[]): InkwellProject {
  const chapters = Array.isArray(parsed) && parsed.length > 0 ? parsed : seedChapters()
  return withAlignedGoals({
    version: 2,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters,
  })
}

export function loadProject(): InkwellProject {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY)
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as InkwellProject
      if (
        parsed &&
        parsed.version === 2 &&
        Array.isArray(parsed.chapters) &&
        parsed.book &&
        parsed.goals
      ) {
        const chapters =
          parsed.chapters.length > 0 ? parsed.chapters : seedChapters()
        return withAlignedGoals({
          ...parsed,
          book: { ...defaultBookMeta(), ...parsed.book },
          goals: { ...defaultWritingGoals(), ...parsed.goals },
          chapters,
        })
      }
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1)
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Manuscript[]
      const project = migrateV1Array(parsed)
      saveProject(project)
      return project
    }

    if (!rawV2) {
      const seeded = seedProject()
      saveProject(seeded)
      return seeded
    }
  } catch {
    /* fall through */
  }

  const seeded = seedProject()
  saveProject(seeded)
  return seeded
}

export function saveProject(project: InkwellProject): InkwellProject {
  const normalized = withAlignedGoals(project)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

/** @deprecated use loadProject */
export function loadManuscripts(): Manuscript[] {
  return loadProject().chapters
}

/** @deprecated use saveProject */
export function saveManuscripts(manuscripts: Manuscript[]) {
  const existing = loadProject()
  saveProject({ ...existing, chapters: manuscripts })
}

export function nextManuscriptId(chapters: Manuscript[]): number {
  return chapters.reduce((max, m) => Math.max(max, m.id), 0) + 1
}

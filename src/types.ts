import type { JSONContent } from '@tiptap/core'

export type Manuscript = {
  id: number
  title: string
  content: JSONContent
}

export type BookMeta = {
  title: string
  subtitle: string
  authorName: string
  series: string
}

export type WritingGoals = {
  manuscriptTargetWords: number | null
  dailyWordGoal: number | null
  /** YYYY-MM-DD (local) when dailyBaselineWordCount was fixed */
  dailyProgressDate: string
  /** Total book words at start of dailyProgressDate */
  dailyBaselineWordCount: number
}

export type InkwellProject = {
  version: 2
  book: BookMeta
  goals: WritingGoals
  chapters: Manuscript[]
}

export function defaultBookMeta(): BookMeta {
  return {
    title: '',
    subtitle: '',
    authorName: '',
    series: '',
  }
}

export function defaultWritingGoals(): WritingGoals {
  return {
    manuscriptTargetWords: null,
    dailyWordGoal: null,
    dailyProgressDate: '',
    dailyBaselineWordCount: 0,
  }
}

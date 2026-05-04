/** DOM targets: `data-inkwell-tour="<id>"` on elements in `App`, `BookTools`, and `ManuscriptToolbar`. */
export type TourDomTarget =
  | 'shelf-books'
  | 'shelf-new'
  | 'shelf-menu-book'
  | 'write-chapters'
  | 'editor-toolbar'
  | 'editor-toolbar-bar'
  | 'editor-toolbar-customize'
  | 'header-workspace-format'
  | 'header-workspace-publish'
  | 'workspace-modes'

export type TourStepId =
  | 'shelf-intro'
  | 'shelf-open-new'
  | 'shelf-pick-book'
  | 'write-chapters'
  | 'write-toolbar-customize'
  | 'write-toolbar-dnd'
  | 'workspace-format'
  | 'workspace-publish'

export type TourStepKind = 'info' | 'action'

export type TourStep = {
  id: TourStepId
  kind: TourStepKind
  /** Primary route context for this step (tour may nudge navigation). */
  route: 'bookshelf' | 'write' | 'format' | 'publish'
  target: TourDomTarget
  title: string
  body: string
  /** Shown under actions as a hint (Esc, etc.). */
  hint?: string
}

export const TUTORIAL_STEPS: TourStep[] = [
  {
    id: 'shelf-intro',
    kind: 'info',
    route: 'bookshelf',
    target: 'shelf-books',
    title: 'Your bookshelf',
    body: 'Reorder books and notes by dragging. Drop a note onto a book to attach it, or use the trash target to remove something. Everything stays on this device until you export.',
    hint: 'Press Esc to pause the tour without finishing it.',
  },
  {
    id: 'shelf-open-new',
    kind: 'action',
    route: 'bookshelf',
    target: 'shelf-new',
    title: 'Create a book',
    body: 'Open New, then choose Book on the next step. You can also add a book with the + control next to Books.',
    hint: 'We advance when the New menu opens.',
  },
  {
    id: 'shelf-pick-book',
    kind: 'action',
    route: 'bookshelf',
    target: 'shelf-menu-book',
    title: 'Choose Book',
    body: 'Pick Book to start a fresh manuscript and jump into the editor.',
    hint: 'We advance when your new book opens in Write.',
  },
  {
    id: 'write-chapters',
    kind: 'info',
    route: 'write',
    target: 'write-chapters',
    title: 'Write',
    body: 'Use the chapter list to add, reorder, or merge sections. Drag a section by its book icon.',
    hint: 'Collapse the list anytime; expand it from the strip on the left.',
  },
  {
    id: 'write-toolbar-customize',
    kind: 'info',
    route: 'write',
    target: 'editor-toolbar-customize',
    title: 'Customize the toolbar',
    body: 'Use Customize toolbar to enter layout mode. The More menu opens automatically so you can stash tools off the main row while keeping them handy. Done exits; Reset to default restores Inkwell’s original tool order.',
    hint: 'Your layout is saved in this browser for every manuscript.',
  },
  {
    id: 'write-toolbar-dnd',
    kind: 'info',
    route: 'write',
    target: 'editor-toolbar-bar',
    title: 'Drag tools on the bar',
    body: 'While customizing, drag any tool by its row to reorder icons on the bar. Drag from the bar onto More (or into the open More list) to move items into overflow—still one click away when you are not customizing.',
    hint: 'Outside customize mode the bar stays fixed so you can write without accidental drags.',
  },
  {
    id: 'workspace-format',
    kind: 'action',
    route: 'write',
    target: 'header-workspace-format',
    title: 'Format',
    body: 'When the draft is ready, open Format for print and ebook previews — typography, margins, and theme presets.',
    hint: 'We advance when the Format workspace opens.',
  },
  {
    id: 'workspace-publish',
    kind: 'action',
    route: 'format',
    target: 'header-workspace-publish',
    title: 'Publish',
    body: 'From Publish, export PDF, EPUB, and more. Flow: write here, refine in Format, then ship from Publish.',
    hint: 'We advance when the Publish workspace opens.',
  },
]

export function indexOfStep(id: TourStepId): number {
  return TUTORIAL_STEPS.findIndex((s) => s.id === id)
}

export function parseResumeStepId(raw: string | undefined): TourStepId | null {
  if (!raw) return null
  const ok = TUTORIAL_STEPS.some((s) => s.id === raw)
  return ok ? (raw as TourStepId) : null
}

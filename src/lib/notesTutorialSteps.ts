/** DOM targets: `data-inkwell-tour="<id>"` (shared attribute with main tour). */
export type NotesTourDomTarget =
  | 'shelf-books'
  | 'shelf-notes'
  | 'shelf-new'
  | 'shelf-menu-note'
  | 'header-book-tools'
  | 'book-tools-linked-notes'
  | 'editor-toolbar'

export type NotesTourStepId =
  | 'notes-shelf-intro'
  | 'notes-shelf-new'
  | 'notes-shelf-create-note'
  | 'notes-write-tools'
  | 'notes-write-linked-panel'
  | 'notes-write-linking'

export type NotesTourStepKind = 'info' | 'action'

export type NotesTourStep = {
  id: NotesTourStepId
  kind: NotesTourStepKind
  route: 'bookshelf' | 'write' | 'format' | 'publish'
  target: NotesTourDomTarget
  title: string
  body: string
  hint?: string
}

export const NOTES_TUTORIAL_STEPS: NotesTourStep[] = [
  {
    id: 'notes-shelf-intro',
    kind: 'info',
    route: 'bookshelf',
    target: 'shelf-notes',
    title: 'Notes on the shelf',
    body: 'This Notes section holds loose notes—research, character sheets, anything that is not the main manuscript. Books and Projects live above; you can drag notes between them when you want structure.\n\nDrag a note onto a book, a project hub, or another note to attach it, or use the note’s overflow menu. Attached notes show up in tools while you write.\n\nThe Start Writing button above the shelf also drops you into a fresh empty note in the editor.',
    hint: 'Esc closes and saves your place. Arrow keys move between steps.',
  },
  {
    id: 'notes-shelf-new',
    kind: 'action',
    route: 'bookshelf',
    target: 'shelf-new',
    title: 'Add something new',
    body: 'Open New, then choose Note on the next step. You can also add a standalone note with the + control in the Notes section (it stays on the shelf until you open it).',
    hint: 'We advance when the New menu opens.',
  },
  {
    id: 'notes-shelf-create-note',
    kind: 'action',
    route: 'bookshelf',
    target: 'shelf-menu-note',
    title: 'Choose Note',
    body: 'Pick Note to open a new blank note in Write. Start Writing does the same in one tap if you prefer.',
    hint: 'We advance when your new note opens in Write.',
  },
  {
    id: 'notes-write-tools',
    kind: 'info',
    route: 'write',
    target: 'header-book-tools',
    title: 'The tools panel',
    body: 'Tap the library icon for book or note metadata, goals, history, linked notes, and exports—without leaving the page.\n\nWhile this guide is on this step, the panel opens for you so you can scroll and try controls.',
    hint: 'The highlight grows to include the whole tools drawer so it stays clickable. Tap the library icon anytime to toggle the panel.',
  },
  {
    id: 'notes-write-linked-panel',
    kind: 'info',
    route: 'write',
    target: 'book-tools-linked-notes',
    title: 'Notebook & linked notes',
    body: 'The master project is listed first; every note attached under it follows.\n\nUse the pop-out arrow to edit a note in a floating window while your chapter stays put.',
    hint: 'The tools drawer stays open here—scroll inside it if the list is long.',
  },
  {
    id: 'notes-write-linking',
    kind: 'info',
    route: 'write',
    target: 'editor-toolbar',
    title: 'Link inside your draft',
    body: 'Type @ to mention sibling notes, chapter titles, the author line, and more.\n\nType [[ for wiki-style links—Inkwell suggests notes as you type. Click an @mention or [[link]] to open that note in a popover.\n\nWhen another note points here, a Backlinks section appears in note tools.',
  },
]

export function indexOfNotesTourStep(id: NotesTourStepId): number {
  return NOTES_TUTORIAL_STEPS.findIndex((s) => s.id === id)
}

export function parseNotesTourResumeStepId(raw: string | undefined): NotesTourStepId | null {
  if (!raw) return null
  return NOTES_TUTORIAL_STEPS.some((s) => s.id === raw) ? (raw as NotesTourStepId) : null
}

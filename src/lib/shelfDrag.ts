export const NOTE_DRAG_MIME = 'application/x-inkwell-note-id'
export const NOTE_DRAG_TEXT_PREFIX = 'inkwell-note:'

export function readShelfDragNoteId(dt: DataTransfer): string | null {
  try {
    const id = dt.getData(NOTE_DRAG_MIME).trim()
    if (id) return id
    const plain = dt.getData('text/plain')
    if (plain.startsWith(NOTE_DRAG_TEXT_PREFIX)) {
      return plain.slice(NOTE_DRAG_TEXT_PREFIX.length).trim()
    }
  } catch {
    /* ignore */
  }
  return null
}

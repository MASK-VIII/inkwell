import { Editor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import type { JSONContent } from '@tiptap/core'
import { PageBreak } from '../tiptap/extensions/PageBreak'

/** Same stack as `ManuscriptEditor` so imported JSON matches the live schema. */
const importExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  PageBreak,
  CharacterCount.configure({ limit: null }),
]

function fallbackDoc(message: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: message }],
      },
    ],
  }
}

/**
 * Run content through a real TipTap editor so ProseMirror fixes or rejects invalid
 * structure before `useEditor` runs in React (which would otherwise throw and white-screen).
 */
export function coerceDocThroughTipTap(doc: JSONContent): JSONContent {
  if (typeof document === 'undefined') return doc

  const mount = document.createElement('div')
  mount.setAttribute('aria-hidden', 'true')
  mount.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;'
  document.body.appendChild(mount)

  let ed: Editor | null = null
  try {
    ed = new Editor({
      element: mount,
      extensions: importExtensions,
      content: doc,
      editable: false,
    })
    return ed.getJSON()
  } catch (e) {
    console.warn('[Inkwell] Imported chapter failed TipTap schema; using fallback paragraph.', e)
    return fallbackDoc(
      'This chapter could not be loaded from the DOCX (invalid structure). Try simplifying lists or tables in Word, then import again.',
    )
  } finally {
    try {
      ed?.destroy()
    } catch {
      /* ignore */
    }
    mount.remove()
  }
}

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import type { TypewriterMode } from '../../typewriterMode'

const inkwellTypewriterScrollKey = new PluginKey('inkwellTypewriterScroll')

const CARET_VIEWPORT_RATIO = 0.45

export function inkwellTypewriterScrollExtension(opts: {
  getTypewriterMode: () => TypewriterMode
  getScrollRoot: () => HTMLElement | null
}) {
  return Extension.create({
    name: 'inkwellTypewriterScroll',
    priority: 1000,

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: inkwellTypewriterScrollKey,
          view(view) {
            let rafId: number | null = null
            let pointerSelecting = false

            const cancelRaf = () => {
              if (rafId != null) {
                window.cancelAnimationFrame(rafId)
                rafId = null
              }
            }

            const scrollCaretIntoView = () => {
              rafId = null
              if (opts.getTypewriterMode() !== 'full') return
              if (!view.hasFocus()) return
              if (pointerSelecting) return

              const scrollRoot = opts.getScrollRoot()
              if (!scrollRoot) return

              const { from } = view.state.selection
              const coords = view.coordsAtPos(from)
              const rootRect = scrollRoot.getBoundingClientRect()
              const caretY = coords.top + (coords.bottom - coords.top) / 2
              const targetY = rootRect.top + rootRect.height * CARET_VIEWPORT_RATIO
              const delta = caretY - targetY

              if (Math.abs(delta) < 4) return
              scrollRoot.scrollTop += delta
            }

            const scheduleScroll = () => {
              if (opts.getTypewriterMode() !== 'full') return
              if (rafId != null) return
              rafId = window.requestAnimationFrame(scrollCaretIntoView)
            }

            const onPointerDown = () => {
              pointerSelecting = true
              cancelRaf()
            }
            const onPointerUp = () => {
              pointerSelecting = false
              scheduleScroll()
            }

            view.dom.addEventListener('pointerdown', onPointerDown)
            window.addEventListener('pointerup', onPointerUp)
            window.addEventListener('pointercancel', onPointerUp)

            return {
              update(nextView: EditorView, prevState) {
                void nextView
                if (opts.getTypewriterMode() !== 'full') return
                const { selection, doc } = view.state
                if (doc.eq(prevState.doc) && selection.eq(prevState.selection)) return
                scheduleScroll()
              },
              destroy() {
                cancelRaf()
                view.dom.removeEventListener('pointerdown', onPointerDown)
                window.removeEventListener('pointerup', onPointerUp)
                window.removeEventListener('pointercancel', onPointerUp)
              },
            }
          },
        }),
      ]
    },
  })
}

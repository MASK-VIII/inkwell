import HorizontalRule from '@tiptap/extension-horizontal-rule'

export const InkwellSceneBreak = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ornament: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-ornament'),
        renderHTML: (attrs) => {
          const o = attrs.ornament as string | null
          return o ? { 'data-ornament': o } : {}
        },
      },
    }
  },
})

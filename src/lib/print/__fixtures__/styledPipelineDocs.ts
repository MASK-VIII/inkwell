import type { JSONContent } from '@tiptap/core'

/** Typical TipTap marks on text nodes (fixture for print pipeline tests). */
export const styledParagraphDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'Italic', marks: [{ type: 'italic' }] },
      ],
    },
  ],
}

/** Legacy-style mark names `b` / `i`. */
export const aliasMarkDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'X', marks: [{ type: 'b' }] },
        { type: 'text', text: 'Y', marks: [{ type: 'i' }] },
      ],
    },
  ],
}

/** Emphasis as wrapper nodes (some imports emit this shape). */
export const wrapperBoldNodeDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'bold',
          content: [{ type: 'text', text: 'WrappedBold' }],
        },
      ],
    },
  ],
}

export const underlineParagraphDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Under', marks: [{ type: 'underline' }] }],
    },
  ],
}

export const listStyledDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Item ', marks: [{ type: 'bold' }] }],
            },
          ],
        },
      ],
    },
  ],
}

export const headingItalicDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title', marks: [{ type: 'italic' }] }],
    },
  ],
}

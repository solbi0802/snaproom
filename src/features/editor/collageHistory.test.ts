import { expect, test } from 'vitest'
import { forgetPhoto, initialHistory, recordEdit, undoEdit } from './collageHistory'

test('a gesture makes one undo entry while separate edits undo in order', () => {
  const group = Symbol()
  let history = recordEdit(initialHistory, document => ({ ...document, gap: 20 }), group)
  history = recordEdit(history, document => ({ ...document, gap: 64 }), group)
  history = recordEdit(history, document => ({ ...document, background: '#345678' }))
  expect(history.past).toHaveLength(2)
  expect(undoEdit(history).document).toMatchObject({ gap: 64, background: '#ffffff' })
  expect(undoEdit(undoEdit(history)).document).toBe(initialHistory.document)
})

test('removing a photo with historical mosaics prevents restoring those regions', () => {
  let history = recordEdit(initialHistory, document => ({
    ...document,
    mosaics: [{ photoId: 'removed', area: { x: 0, y: 0, width: 1, height: 1 } }],
  }))
  history = recordEdit(history, document => ({ ...document, mosaics: [], background: '#345678' }))
  const cleaned = forgetPhoto(history, 'removed')
  expect(cleaned.document.background).toBe('#345678')
  expect(cleaned.past).toHaveLength(1)
  expect(undoEdit(cleaned).document).toMatchObject({ background: '#ffffff', mosaics: [] })
})

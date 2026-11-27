import { expect, test } from 'vitest'
import { coverCrop } from './collage'
import { intersect, rectangleBetween, toCanvasRect, toPhotoArea } from './mosaic'

test('a backward drag outside a cropped photo is clipped to its original photo', () => {
  const cell = { x: 12, y: 12, width: 200, height: 200 }
  const crop = coverCrop(800, 400, cell)
  const drag = rectangleBetween({ x: 112, y: 112 }, { x: 0, y: 0 })
  const clipped = intersect(drag, cell)
  expect(clipped).toEqual({ x: 12, y: 12, width: 100, height: 100 })
  if (!clipped) throw new Error('Selection should intersect the photo')
  expect(toPhotoArea(clipped, cell, crop, 800, 400)).toEqual({ x: .25, y: 0, width: .25, height: .5 })
})

test('a source region is clipped to the visible part after changing layout', () => {
  const cell = { x: 500, y: 12, width: 200, height: 400 }
  const crop = coverCrop(800, 400, cell)
  const visible = intersect({ x: 250, y: 100, width: 200, height: 100 }, crop)
  expect(visible).toEqual({ x: 300, y: 100, width: 150, height: 100 })
  if (!visible) throw new Error('Mosaic region should be partially visible')
  expect(toCanvasRect(visible, crop, cell)).toEqual({ x: 500, y: 112, width: 150, height: 100 })
})

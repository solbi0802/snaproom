import { expect, test } from 'vitest'
import { COLLAGE_SIZE, collageCells, coverCrop } from './collage'

for (const layout of ['grid', 'featured'] as const) {
  test(`${layout} fits one through four photos without overlap`, () => {
    for (const count of [1, 2, 3, 4]) {
      const cells = collageCells(count, layout)
      expect(cells).toHaveLength(count)
      cells.forEach((cell, index) => {
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(cell.x + cell.width).toBeLessThanOrEqual(COLLAGE_SIZE)
        expect(cell.y + cell.height).toBeLessThanOrEqual(COLLAGE_SIZE)
        for (const other of cells.slice(index + 1)) {
          expect(cell.x + cell.width <= other.x || other.x + other.width <= cell.x ||
            cell.y + cell.height <= other.y || other.y + other.height <= cell.y).toBe(true)
        }
      })
      if (layout === 'featured' && count >= 3) expect(cells[0].height).toBeGreaterThan(cells[1].height)
    }
  })
}

test('cover crop centers horizontal and vertical source images without distortion', () => {
  const cell = { x: 0, y: 0, width: 200, height: 200 }
  expect(coverCrop(800, 400, cell)).toEqual({ x: 200, y: 0, width: 400, height: 400 })
  expect(coverCrop(400, 800, cell)).toEqual({ x: 0, y: 200, width: 400, height: 400 })
})

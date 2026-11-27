import type { Rect } from './collage'

export type MosaicRegion = { photoId: string; area: Rect }
export type Point = { x: number; y: number }

export function rectangleBetween(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function intersect(rect: Rect, bounds: Rect): Rect | null {
  const x = Math.max(rect.x, bounds.x)
  const y = Math.max(rect.y, bounds.y)
  const width = Math.min(rect.x + rect.width, bounds.x + bounds.width) - x
  const height = Math.min(rect.y + rect.height, bounds.y + bounds.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

export function toPhotoArea(selection: Rect, cell: Rect, crop: Rect, width: number, height: number): Rect {
  return {
    x: (crop.x + (selection.x - cell.x) * crop.width / cell.width) / width,
    y: (crop.y + (selection.y - cell.y) * crop.height / cell.height) / height,
    width: selection.width * crop.width / cell.width / width,
    height: selection.height * crop.height / cell.height / height,
  }
}

export function toCanvasRect(source: Rect, crop: Rect, cell: Rect): Rect {
  return {
    x: cell.x + (source.x - crop.x) * cell.width / crop.width,
    y: cell.y + (source.y - crop.y) * cell.height / crop.height,
    width: source.width * cell.width / crop.width,
    height: source.height * cell.height / crop.height,
  }
}

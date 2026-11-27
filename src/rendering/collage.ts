import { intersect, toCanvasRect } from './mosaic'
import type { MosaicRegion } from './mosaic'

export const COLLAGE_SIZE = 1000
const GAP = 12
const INNER = COLLAGE_SIZE - 2 * GAP

export type Layout = 'grid' | 'featured'
export type Rect = { x: number; y: number; width: number; height: number }

export function collageCells(count: number, layout: Layout): Rect[] {
  const half = (INNER - GAP) / 2
  const second = GAP + half + GAP
  if (count < 1 || count > 4) return []
  if (count === 1) return [{ x: GAP, y: GAP, width: INNER, height: INNER }]
  if (count === 2) return [GAP, second].map(x => ({ x, y: GAP, width: half, height: INNER }))

  if (layout === 'featured') {
    const height = (INNER - (count - 2) * GAP) / (count - 1)
    return [
      { x: GAP, y: GAP, width: half, height: INNER },
      ...Array.from({ length: count - 1 }, (_, index) => ({
        x: second, y: GAP + index * (height + GAP), width: half, height,
      })),
    ]
  }

  return [
    { x: GAP, y: GAP, width: half, height: half },
    { x: second, y: GAP, width: half, height: half },
    { x: GAP, y: second, width: count === 3 ? INNER : half, height: half },
    ...(count === 4 ? [{ x: second, y: second, width: half, height: half }] : []),
  ]
}

export function coverCrop(width: number, height: number, cell: Rect): Rect {
  const scale = Math.max(cell.width / width, cell.height / height)
  const cropWidth = cell.width / scale
  const cropHeight = cell.height / scale
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight }
}

export type CollagePhoto = { id: string; image: HTMLImageElement }

export function drawCollage(canvas: HTMLCanvasElement, photos: readonly CollagePhoto[], layout: Layout, mosaics: readonly MosaicRegion[]) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  canvas.width = COLLAGE_SIZE
  canvas.height = COLLAGE_SIZE
  context.fillStyle = 'white'
  context.fillRect(0, 0, COLLAGE_SIZE, COLLAGE_SIZE)
  const pixelCanvas = mosaics.length ? document.createElement('canvas') : null
  collageCells(photos.length, layout).forEach((cell, index) => {
    const { id, image } = photos[index]
    const crop = coverCrop(image.naturalWidth, image.naturalHeight, cell)
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, cell.x, cell.y, cell.width, cell.height)
    if (!pixelCanvas) return

    for (const { photoId, area } of mosaics) {
      if (photoId !== id) continue
      const visible = intersect({
        x: area.x * image.naturalWidth,
        y: area.y * image.naturalHeight,
        width: area.width * image.naturalWidth,
        height: area.height * image.naturalHeight,
      }, crop)
      if (!visible) continue

      const target = toCanvasRect(visible, crop, cell)
      pixelCanvas.width = Math.max(1, Math.floor(target.width / 24))
      pixelCanvas.height = Math.max(1, Math.floor(target.height / 24))
      const pixelContext = pixelCanvas.getContext('2d')
      if (!pixelContext) throw new Error('Mosaic canvas is unavailable')
      pixelContext.imageSmoothingQuality = 'high'
      // Sample the composed canvas so transparent pixels include the background.
      pixelContext.drawImage(canvas, target.x, target.y, target.width, target.height, 0, 0, pixelCanvas.width, pixelCanvas.height)
      context.save()
      context.imageSmoothingEnabled = false
      context.drawImage(pixelCanvas, target.x, target.y, target.width, target.height)
      context.restore()
    }
  })
}

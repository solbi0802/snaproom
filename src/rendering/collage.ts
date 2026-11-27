import { intersect, toCanvasRect } from './mosaic'
import type { MosaicRegion } from './mosaic'

export const COLLAGE_SIZE = 1000
export type ImageSize = { width: number; height: number }
export const COLLAGE_FRAME: ImageSize = { width: COLLAGE_SIZE, height: COLLAGE_SIZE }
export const MAX_COLLAGE_GAP = 64
export type CollageAppearance = { background: string; gap: number }
export const COLLAGE_DEFAULTS: CollageAppearance = { background: '#ffffff', gap: 12 }

export type Layout = 'grid' | 'featured'
export type Rect = { x: number; y: number; width: number; height: number }

export function collageCells(count: number, layout: Layout, gap = COLLAGE_DEFAULTS.gap): Rect[] {
  const inner = COLLAGE_SIZE - 2 * gap
  const half = (inner - gap) / 2
  const second = gap + half + gap
  if (count < 1 || count > 4) return []
  if (count === 1) return [{ x: gap, y: gap, width: inner, height: inner }]
  if (count === 2) return [gap, second].map(x => ({ x, y: gap, width: half, height: inner }))

  if (layout === 'featured') {
    const height = (inner - (count - 2) * gap) / (count - 1)
    return [
      { x: gap, y: gap, width: half, height: inner },
      ...Array.from({ length: count - 1 }, (_, index) => ({
        x: second, y: gap + index * (height + gap), width: half, height,
      })),
    ]
  }

  return [
    { x: gap, y: gap, width: half, height: half },
    { x: second, y: gap, width: half, height: half },
    { x: gap, y: second, width: count === 3 ? inner : half, height: half },
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

export function drawCollage(
  canvas: HTMLCanvasElement,
  photos: readonly CollagePhoto[],
  layout: Layout,
  mosaics: readonly MosaicRegion[],
  { background, gap }: CollageAppearance = COLLAGE_DEFAULTS,
) {
  drawPhotos(canvas, photos, collageCells(photos.length, layout, gap), COLLAGE_FRAME, mosaics, 24, background)
}

export function photoPreviewSize({ width, height }: ImageSize): ImageSize {
  const scale = COLLAGE_SIZE / Math.max(width, height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function drawIndividualPhoto(canvas: HTMLCanvasElement, photo: CollagePhoto, size: ImageSize, mosaics: readonly MosaicRegion[]) {
  drawPhotos(canvas, [photo], [{ x: 0, y: 0, ...size }], size, mosaics, 24 * Math.max(size.width, size.height) / COLLAGE_SIZE)
}

function drawPhotos(
  canvas: HTMLCanvasElement,
  photos: readonly CollagePhoto[],
  cells: readonly Rect[],
  size: ImageSize,
  mosaics: readonly MosaicRegion[],
  pixelSize: number,
  background?: string,
) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  canvas.width = size.width
  canvas.height = size.height
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, size.width, size.height)
  }
  const pixelCanvas = mosaics.length ? document.createElement('canvas') : null
  cells.forEach((cell, index) => {
    const { id, image } = photos[index]
    const crop = background
      ? coverCrop(image.naturalWidth, image.naturalHeight, cell)
      : { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
    if (background) {
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, cell.x, cell.y, cell.width, cell.height)
    } else {
      context.drawImage(image, cell.x, cell.y, cell.width, cell.height)
    }
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
      pixelCanvas.width = Math.max(1, Math.floor(target.width / pixelSize))
      pixelCanvas.height = Math.max(1, Math.floor(target.height / pixelSize))
      const pixelContext = pixelCanvas.getContext('2d')
      if (!pixelContext) throw new Error('Mosaic canvas is unavailable')
      pixelContext.imageSmoothingQuality = 'high'
      // Sample the composed canvas so transparent pixels include the background.
      pixelContext.drawImage(canvas, target.x, target.y, target.width, target.height, 0, 0, pixelCanvas.width, pixelCanvas.height)
      context.save()
      context.imageSmoothingEnabled = false
      // Replace translucent source pixels instead of compositing them over themselves.
      if (!background) context.clearRect(target.x, target.y, target.width, target.height)
      context.drawImage(pixelCanvas, target.x, target.y, target.width, target.height)
      context.restore()
    }
  })
}

import { COLLAGE_SIZE } from './collage'

export const stickerArt = {
  star: { label: '별', symbol: '★', color: '#ffd05b', path: 'M50 8 62 36 92 39 69 60 76 91 50 75 24 91 31 60 8 39 38 36Z' },
  heart: { label: '하트', symbol: '♥', color: '#f27b98', path: 'M50 87C36 77 8 58 8 35C8 12 37 6 50 26C63 6 92 12 92 35C92 58 64 77 50 87Z' },
  sparkle: { label: '반짝이', symbol: '✦', color: '#bba4f3', path: 'M43 7Q47 36 79 43Q47 50 43 80Q38 50 7 43Q38 36 43 7Z M76 53Q79 69 94 75Q79 79 76 94Q72 79 58 75Q72 70 76 53Z' },
  flower: { label: '꽃', symbol: '✿', color: '#74c6b9', path: 'M50 28C28 1 8 30 30 45C0 48 17 83 41 68C35 96 73 96 64 68C90 81 104 47 73 44C95 24 67 4 50 28Z' },
} as const

export type StickerKind = keyof typeof stickerArt
export type Sticker = { id: string; kind: StickerKind; x: number; y: number; size: number }
export const stickerSize = { min: 64, initial: 160, max: 400 } as const

export function placeSticker(sticker: Sticker): Sticker {
  const size = Math.max(stickerSize.min, Math.min(stickerSize.max, sticker.size))
  const min = size / 2
  const max = COLLAGE_SIZE - min
  return { ...sticker, size, x: Math.max(min, Math.min(max, sticker.x)), y: Math.max(min, Math.min(max, sticker.y)) }
}

export type StickerCorner = readonly [horizontal: -1 | 1, vertical: -1 | 1]

export function resizeSticker(sticker: Sticker, requestedSize: number, [horizontal, vertical]: StickerCorner): Sticker {
  const anchorX = sticker.x - horizontal * sticker.size / 2
  const anchorY = sticker.y - vertical * sticker.size / 2
  const width = horizontal === 1 ? COLLAGE_SIZE - anchorX : anchorX
  const height = vertical === 1 ? COLLAGE_SIZE - anchorY : anchorY
  const size = Math.max(stickerSize.min, Math.min(stickerSize.max, width, height, requestedSize))
  return { ...sticker, size, x: anchorX + horizontal * size / 2, y: anchorY + vertical * size / 2 }
}

export function drawStickers(context: CanvasRenderingContext2D, stickers: readonly Sticker[]) {
  for (const { kind, x, y, size } of stickers) {
    const art = stickerArt[kind]
    const shape = new Path2D(art.path)
    context.save()
    context.translate(x - size / 2, y - size / 2)
    context.scale(size / 100, size / 100)
    context.lineJoin = 'round'
    context.lineWidth = 7
    context.strokeStyle = '#fff'
    context.fillStyle = art.color
    context.stroke(shape)
    context.fill(shape)
    context.restore()
  }
}

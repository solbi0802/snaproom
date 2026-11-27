import { useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { COLLAGE_SIZE } from '../../rendering/collage'
import { drawStickers, resizeSticker, stickerArt } from '../../rendering/stickers'
import type { Sticker, StickerCorner } from '../../rendering/stickers'
import { Button } from '../../shared/ui/Button'
import styles from './CollageEditor.module.css'

type Props = {
  stickers: readonly Sticker[]
  active: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, update: (sticker: Sticker) => Sticker) => void
}

const arrowOffsets: Readonly<Record<string, readonly [number, number] | undefined>> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

const resizeCorners = [
  { label: '왼쪽 위', corner: [-1, -1], position: 'top-left' },
  { label: '오른쪽 위', corner: [1, -1], position: 'top-right' },
  { label: '왼쪽 아래', corner: [-1, 1], position: 'bottom-left' },
  { label: '오른쪽 아래', corner: [1, 1], position: 'bottom-right' },
] as const

export function StickerLayer({ stickers, active, selectedId, onSelect, onUpdate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const selected = active ? stickers.find(sticker => sticker.id === selectedId) : undefined
  const drag = useRef<{ pointerId: number; sticker: Sticker; corner?: StickerCorner; clientX: number; clientY: number; scale: number } | null>(null)

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, COLLAGE_SIZE, COLLAGE_SIZE)
    drawStickers(context, stickers)
  }, [stickers])

  function start(event: PointerEvent<HTMLButtonElement>, sticker: Sticker, corner?: StickerCorner) {
    if (!event.isPrimary || event.button !== 0) return
    const width = canvas.current?.clientWidth
    if (!width) return
    onSelect(sticker.id)
    drag.current = { pointerId: event.pointerId, sticker, corner, clientX: event.clientX, clientY: event.clientY, scale: COLLAGE_SIZE / width }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = (event.clientX - current.clientX) * current.scale
    const dy = (event.clientY - current.clientY) * current.scale
    const original = current.sticker
    const corner = current.corner
    if (corner) {
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx * corner[0] : dy * corner[1]
      onUpdate(original.id, () => resizeSticker(original, original.size + delta, corner))
    } else {
      onUpdate(original.id, sticker => ({ ...sticker, x: original.x + dx, y: original.y + dy }))
    }
  }

  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    move(event)
    stop(event)
  }

  function changeByKey(event: KeyboardEvent<HTMLButtonElement>, id: string, corner?: StickerCorner) {
    const offset = arrowOffsets[event.key]
    if (!offset) return
    event.preventDefault()
    const step = event.shiftKey ? 50 : 10
    onSelect(id)
    onUpdate(id, sticker => corner
      ? resizeSticker(sticker, sticker.size + (offset[0] || -offset[1]) * step, corner)
      : { ...sticker, x: sticker.x + offset[0] * step, y: sticker.y + offset[1] * step })
  }

  return (
    <div className={styles.stickerLayer}>
      <canvas ref={canvas} width={COLLAGE_SIZE} height={COLLAGE_SIZE} aria-hidden="true" />
      {active && stickers.map((sticker, index) => (
        <Button key={sticker.id} variant="ghost" className={styles.stickerHitArea}
          aria-label={`${index + 1}. ${stickerArt[sticker.kind].label} 스티커`} aria-pressed={selectedId === sticker.id}
          aria-describedby="sticker-instructions" aria-description="방향키로 스티커를 옮길 수 있어요."
          style={{
            left: `${(sticker.x - sticker.size / 2) / COLLAGE_SIZE * 100}%`,
            top: `${(sticker.y - sticker.size / 2) / COLLAGE_SIZE * 100}%`,
            width: `${sticker.size / COLLAGE_SIZE * 100}%`,
            height: `${sticker.size / COLLAGE_SIZE * 100}%`,
          }}
          onClick={() => onSelect(sticker.id)} onKeyDown={event => changeByKey(event, sticker.id)}
          onPointerDown={event => start(event, sticker)} onPointerMove={move} onPointerUp={finish}
          onPointerCancel={stop} onLostPointerCapture={stop} />
      ))}
      {selected && resizeCorners.map(({ label, corner, position }) => (
        <Button key={`${selected.id}-${position}`} variant="ghost" className={styles.stickerResizeHandle}
          data-corner={position}
          aria-label={`스티커 크기 조절 · ${label}`}
          aria-description="위쪽 또는 오른쪽 방향키로 키우고, 아래쪽 또는 왼쪽 방향키로 줄일 수 있어요."
          style={{
            left: `${(selected.x + corner[0] * selected.size / 2) / COLLAGE_SIZE * 100}%`,
            top: `${(selected.y + corner[1] * selected.size / 2) / COLLAGE_SIZE * 100}%`,
          }}
          onKeyDown={event => changeByKey(event, selected.id, corner)}
          onPointerDown={event => start(event, selected, corner)} onPointerMove={move} onPointerUp={finish}
          onPointerCancel={stop} onLostPointerCapture={stop}>
          <span className={styles.stickerResizeGrip} aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}

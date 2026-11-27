import { useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { COLLAGE_SIZE } from '../../rendering/collage'
import { drawStickers, stickerArt } from '../../rendering/stickers'
import type { Sticker } from '../../rendering/stickers'
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

export function StickerLayer({ stickers, active, selectedId, onSelect, onUpdate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ pointerId: number; sticker: Sticker; clientX: number; clientY: number; scale: number } | null>(null)

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, COLLAGE_SIZE, COLLAGE_SIZE)
    drawStickers(context, stickers)
  }, [stickers])

  function start(event: PointerEvent<HTMLButtonElement>, sticker: Sticker) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    const width = canvas.current?.clientWidth
    if (!width) return
    onSelect(sticker.id)
    drag.current = { pointerId: event.pointerId, sticker, clientX: event.clientX, clientY: event.clientY, scale: COLLAGE_SIZE / width }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const x = current.sticker.x + (event.clientX - current.clientX) * current.scale
    const y = current.sticker.y + (event.clientY - current.clientY) * current.scale
    onUpdate(current.sticker.id, sticker => ({ ...sticker, x, y }))
  }

  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  function moveByKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const offset = arrowOffsets[event.key]
    if (!offset) return
    event.preventDefault()
    const step = event.shiftKey ? 50 : 10
    onSelect(id)
    onUpdate(id, sticker => ({ ...sticker, x: sticker.x + offset[0] * step, y: sticker.y + offset[1] * step }))
  }

  return (
    <div className={styles.stickerLayer}>
      <canvas ref={canvas} width={COLLAGE_SIZE} height={COLLAGE_SIZE} aria-hidden="true" />
      {active && stickers.map((sticker, index) => (
        <Button key={sticker.id} variant="ghost" className={styles.stickerHitArea}
          aria-label={`${index + 1}. ${stickerArt[sticker.kind].label} 스티커`} aria-pressed={selectedId === sticker.id}
          aria-describedby="sticker-instructions"
          style={{
            left: `${(sticker.x - sticker.size / 2) / COLLAGE_SIZE * 100}%`,
            top: `${(sticker.y - sticker.size / 2) / COLLAGE_SIZE * 100}%`,
            width: `${sticker.size / COLLAGE_SIZE * 100}%`,
            height: `${sticker.size / COLLAGE_SIZE * 100}%`,
          }}
          onClick={() => onSelect(sticker.id)} onKeyDown={event => moveByKey(event, sticker.id)}
          onPointerDown={event => start(event, sticker)} onPointerMove={move} onPointerUp={stop}
          onPointerCancel={stop} onLostPointerCapture={stop} />
      ))}
    </div>
  )
}

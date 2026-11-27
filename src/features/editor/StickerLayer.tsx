import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { ImageSize } from '../../rendering/collage'
import { drawStickers, placeSticker, resizeSticker, stickerArt, stickerScale } from '../../rendering/stickers'
import type { Sticker, StickerCorner } from '../../rendering/stickers'
import { Button } from '../../shared/ui/Button'
import styles from './CollageEditor.module.css'

type Props = {
  stickers: readonly Sticker[]
  frame: ImageSize
  active: boolean
  selectedId: string | null
  focusStickerId: string | null
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

type StickerDrag = {
  pointerId: number
  sticker: Sticker
  corner?: StickerCorner
  clientX: number
  clientY: number
  scaleX: number
  scaleY: number
  frame: number | null
  next: Sticker
}

function draggedSticker(drag: StickerDrag, clientX: number, clientY: number, frame: ImageSize) {
  const { sticker, corner, scaleX, scaleY } = drag
  const dx = (clientX - drag.clientX) * scaleX
  const dy = (clientY - drag.clientY) * scaleY
  if (corner) {
    const delta = Math.abs(dx) >= Math.abs(dy) ? dx * corner[0] : dy * corner[1]
    return resizeSticker(sticker, sticker.size + delta, corner, frame)
  }
  return placeSticker({ ...sticker, x: sticker.x + dx, y: sticker.y + dy }, frame)
}

export function StickerLayer({ stickers, frame, active, selectedId, focusStickerId, onSelect, onUpdate }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const newlyAdded = useRef<HTMLButtonElement>(null)
  const drag = useRef<StickerDrag | null>(null)
  const [draft, setDraft] = useState<Sticker | null>(null)
  const visibleStickers = useMemo(
    () => active && draft ? stickers.map(sticker => sticker.id === draft.id ? draft : sticker) : stickers,
    [active, draft, stickers],
  )
  const selected = active ? visibleStickers.find(sticker => sticker.id === selectedId) : undefined

  useEffect(() => {
    if (focusStickerId) newlyAdded.current?.focus()
  }, [focusStickerId])

  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, frame.width, frame.height)
    drawStickers(context, visibleStickers)
  }, [visibleStickers, frame.width, frame.height])

  useEffect(() => () => {
    const current = drag.current
    if (current && current.frame !== null) cancelAnimationFrame(current.frame)
  }, [])

  function start(event: PointerEvent<HTMLButtonElement>, sticker: Sticker, corner?: StickerCorner) {
    if (!active || !event.isPrimary || event.button !== 0 || drag.current) return
    const bounds = canvas.current?.getBoundingClientRect()
    if (!bounds?.width || !bounds.height || !layer.current) return
    layer.current.setPointerCapture(event.pointerId)
    onSelect(sticker.id)
    drag.current = {
      pointerId: event.pointerId, sticker, corner, clientX: event.clientX, clientY: event.clientY,
      scaleX: frame.width / bounds.width, scaleY: frame.height / bounds.height, frame: null, next: sticker,
    }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!active || !current || current.pointerId !== event.pointerId) return
    current.next = draggedSticker(current, event.clientX, event.clientY, frame)
    if (current.frame !== null) return
    current.frame = requestAnimationFrame(() => {
      current.frame = null
      setDraft(current.next)
    })
  }

  function stop(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.frame !== null) cancelAnimationFrame(current.frame)
    drag.current = null
    setDraft(null)
    return current
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    const current = stop(event)
    if (active && current) {
      const next = draggedSticker(current, event.clientX, event.clientY, frame)
      onUpdate(next.id, () => next)
    }
  }

  function changeByKey(event: KeyboardEvent<HTMLButtonElement>, id: string, corner?: StickerCorner) {
    const offset = arrowOffsets[event.key]
    if (!offset) return
    event.preventDefault()
    const step = (event.shiftKey ? 50 : 10) * stickerScale(frame)
    onSelect(id)
    onUpdate(id, sticker => corner
      ? resizeSticker(sticker, sticker.size + (offset[0] || -offset[1]) * step, corner, frame)
      : { ...sticker, x: sticker.x + offset[0] * step, y: sticker.y + offset[1] * step })
  }

  return (
    <div ref={layer} className={styles.stickerLayer} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={stop} onLostPointerCapture={stop}>
      <canvas ref={canvas} width={frame.width} height={frame.height} aria-hidden="true" />
      {active && visibleStickers.map((sticker, index) => (
        <Button key={sticker.id} ref={sticker.id === focusStickerId ? newlyAdded : undefined}
          variant="ghost" className={styles.stickerHitArea}
          aria-label={`${index + 1}. ${stickerArt[sticker.kind].label} 스티커`} aria-pressed={selectedId === sticker.id}
          aria-describedby="sticker-instructions" aria-description="방향키로 스티커를 옮길 수 있어요."
          style={{
            left: `${(sticker.x - sticker.size / 2) / frame.width * 100}%`,
            top: `${(sticker.y - sticker.size / 2) / frame.height * 100}%`,
            width: `${sticker.size / frame.width * 100}%`,
            height: `${sticker.size / frame.height * 100}%`,
          }}
          onClick={() => onSelect(sticker.id)} onKeyDown={event => changeByKey(event, sticker.id)}
          onPointerDown={event => start(event, sticker)} />
      ))}
      {selected && resizeCorners.map(({ label, corner, position }) => (
        <Button key={`${selected.id}-${position}`} variant="ghost" className={styles.stickerResizeHandle}
          data-corner={position}
          aria-label={`스티커 크기 조절 · ${label}`}
          aria-description="위쪽 또는 오른쪽 방향키로 키우고, 아래쪽 또는 왼쪽 방향키로 줄일 수 있어요."
          style={{
            left: `${(selected.x + corner[0] * selected.size / 2) / frame.width * 100}%`,
            top: `${(selected.y + corner[1] * selected.size / 2) / frame.height * 100}%`,
          }}
          onKeyDown={event => changeByKey(event, selected.id, corner)}
          onPointerDown={event => start(event, selected, corner)}>
          <span className={styles.stickerResizeGrip} aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}

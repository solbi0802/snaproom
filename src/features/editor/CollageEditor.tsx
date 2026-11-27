import { useEffect, useRef, useState } from 'react'
import type { Dispatch, FormEvent, PointerEvent, SetStateAction } from 'react'
import { COLLAGE_SIZE, collageCells, coverCrop, drawCollage } from '../../rendering/collage'
import type { CollagePhoto, Layout, Rect } from '../../rendering/collage'
import { intersect, rectangleBetween, toPhotoArea } from '../../rendering/mosaic'
import type { MosaicRegion, Point } from '../../rendering/mosaic'
import { drawStickers, placeSticker, stickerArt, stickerSize } from '../../rendering/stickers'
import type { Sticker, StickerKind } from '../../rendering/stickers'
import { Button } from '../../shared/ui/Button'
import { StickerLayer } from './StickerLayer'
import { Notice } from '../../shared/ui/Notice'
import styles from './CollageEditor.module.css'

type Props = {
  photos: readonly { id: string; url: string; name: string }[]
  layout: Layout
  mosaics: readonly MosaicRegion[]
  stickers: readonly Sticker[]
  setStickers: Dispatch<SetStateAction<Sticker[]>>
  onMosaic: (region: MosaicRegion) => void
  onRemoveMosaic: () => void
  onLayout: (layout: Layout) => void
  onSelect: () => void
  onExport: (exporting: boolean) => void
}

export function CollageEditor({ photos, layout, mosaics, stickers, setStickers, onMosaic, onRemoveMosaic, onLayout, onSelect, onExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resultUrl = useRef<string | null>(null)
  const mounted = useRef(false)
  const [images, setImages] = useState<CollagePhoto[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [tool, setTool] = useState<'mosaic' | 'sticker' | null>(null)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const stickerTool = useRef<HTMLButtonElement>(null)
  const mosaicMode = tool === 'mosaic'
  const stickerMode = tool === 'sticker'
  const selectedSticker = stickers.find(sticker => sticker.id === selectedStickerId)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [mosaicMessage, setMosaicMessage] = useState('')
  const drag = useRef<{ pointerId: number; index: number; start: Point } | null>(null)
  const cells = collageCells(photos.length, layout)

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void Promise.all(photos.map(async ({ id, url }) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return { id, image }
    })).then(loaded => {
      if (!cancelled) setImages(loaded)
    }, () => {
      if (!cancelled) setError('사진 미리보기를 만들 수 없어요. 사진 선택으로 돌아가 다시 시도해 주세요.')
    })
    return () => {
      cancelled = true
      mounted.current = false
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
      resultUrl.current = null
    }
  }, [photos])

  useEffect(() => {
    if (!canvasRef.current || !images.length) return
    try {
      drawCollage(canvasRef.current, images, layout, mosaics)
    } catch {
      // Report the failure through the same asynchronous path as image decoding.
      let active = true
      queueMicrotask(() => {
        if (active) setError('미리보기를 그릴 수 없어요. 사진 선택으로 돌아가 다시 시도해 주세요.')
      })
      return () => { active = false }
    }
  }, [images, layout, mosaics])

  function applyMosaic(index: number, selection: Rect) {
    const photo = images[index]
    const cell = cells[index]
    if (!photo || !cell) return
    const clipped = intersect(selection, cell)
    if (!clipped || clipped.width < 8 || clipped.height < 8) {
      setMosaicMessage('모자이크 영역을 조금 더 크게 선택해 주세요.')
      return
    }
    const { naturalWidth: width, naturalHeight: height } = photo.image
    onMosaic({ photoId: photo.id, area: toPhotoArea(clipped, cell, coverCrop(width, height, cell), width, height) })
    setMosaicMessage(`${index + 1}번 사진에 모자이크를 적용했어요.`)
  }

  function pointerPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * COLLAGE_SIZE / bounds.width,
      y: (event.clientY - bounds.top) * COLLAGE_SIZE / bounds.height,
    }
  }

  function startMosaic(event: PointerEvent<HTMLCanvasElement>) {
    if (!mosaicMode || saving || !images.length || !event.isPrimary || event.button !== 0) return
    const start = pointerPoint(event)
    const index = cells.findIndex(cell => start.x >= cell.x && start.x < cell.x + cell.width &&
      start.y >= cell.y && start.y < cell.y + cell.height)
    if (index < 0) return
    drag.current = { pointerId: event.pointerId, index, start }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveMosaic(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    setSelection(intersect(rectangleBetween(current.start, pointerPoint(event)), cells[current.index]))
  }

  function finishMosaic(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    cancelMosaic(event)
    applyMosaic(current.index, rectangleBetween(current.start, pointerPoint(event)))
  }

  function cancelMosaic(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setSelection(null)
  }

  function applyForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const index = Number(fields.get('photo'))
    const cell = cells[index]
    if (!cell) return
    const fraction = (name: string) => Number(fields.get(name)) / 100
    applyMosaic(index, {
      x: cell.x + fraction('left') * cell.width,
      y: cell.y + fraction('top') * cell.height,
      width: fraction('width') * cell.width,
      height: fraction('height') * cell.height,
    })
  }

  function addSticker(kind: StickerKind) {
    const id = crypto.randomUUID()
    const center = COLLAGE_SIZE / 2 + (stickers.length % 6) * 24
    setStickers(current => [...current, { id, kind, x: center, y: center, size: stickerSize.initial }])
    setSelectedStickerId(id)
  }

  function updateSticker(id: string, update: (sticker: Sticker) => Sticker) {
    setStickers(current => current.map(sticker => sticker.id === id ? placeSticker(update(sticker)) : sticker))
  }

  function removeSticker(id: string) {
    setStickers(current => current.filter(sticker => sticker.id !== id))
    setSelectedStickerId(null)
    stickerTool.current?.focus()
  }

  function backToLayout() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = null
    setPreview(null)
    onExport(false)
  }

  function showExport() {
    if (saving || !images.length) return
    setSaving(true)
    setError('')
    const fail = () => {
      setSaving(false)
      setError('PNG를 만들 수 없어요. 저장을 다시 시도해 주세요.')
    }

    try {
      const output = document.createElement('canvas')
      drawCollage(output, images, layout, mosaics)
      const context = output.getContext('2d')
      if (!context) { fail(); return }
      drawStickers(context, stickers)
      output.toBlob(blob => {
        if (!mounted.current) return
        if (!blob) { fail(); return }
        const url = URL.createObjectURL(blob)
        resultUrl.current = url
        setPreview(url)
        setSaving(false)
        onExport(true)
      }, 'image/png')
    } catch {
      fail()
    }
  }

  return (
    <section className={styles.editor} aria-labelledby="collage-heading">
      <h1 id="collage-heading">{preview ? '저장 미리보기' : '사진 배치'}</h1>
      {!preview && (
        <div className={styles.toolbar} role="group" aria-label="사진 레이아웃">
          <Button aria-pressed={layout === 'grid'} onClick={() => onLayout('grid')} disabled={saving}>기본 배치</Button>
          <Button aria-pressed={layout === 'featured'} onClick={() => onLayout('featured')} disabled={saving || photos.length < 3}>첫 사진 강조</Button>
        </div>
      )}
      {!preview && (
        <div className={styles.toolbar} role="group" aria-label="편집 도구">
          <Button aria-pressed={mosaicMode} disabled={!images.length || saving} onClick={() => setTool(mosaicMode ? null : 'mosaic')}>모자이크</Button>
          <Button ref={stickerTool} aria-pressed={stickerMode} disabled={!images.length || saving}
            onClick={() => setTool(stickerMode ? null : 'sticker')}>스티커</Button>
          <Button variant="ghost" disabled={!mosaics.length || saving} onClick={() => {
            onRemoveMosaic()
            setMosaicMessage('마지막 모자이크를 지웠어요.')
          }}>마지막 모자이크 지우기</Button>
        </div>
      )}
      {!preview && mosaicMode && <p className={styles.meta}>사진 안에서 가릴 영역을 드래그하세요.</p>}
      {!preview && stickerMode && (
        <div className={styles.stickerControls}>
          <div className={styles.toolbar} role="group" aria-label="스티커 추가">
            {(Object.keys(stickerArt) as StickerKind[]).map(kind => (
              <Button key={kind} disabled={saving} onClick={() => addSticker(kind)}>
                <span aria-hidden="true" style={{ color: stickerArt[kind].color }}>{stickerArt[kind].symbol}</span>
                {stickerArt[kind].label} 추가
              </Button>
            ))}
          </div>
          <p id="sticker-instructions" className={styles.meta}>스티커를 끌어서 옮기세요. 키보드에서는 스티커에 초점을 두고 방향키로 옮길 수 있어요.</p>
          {selectedSticker && (
            <div className={styles.stickerSettings}>
              <label>스티커 크기 <input type="range" min={stickerSize.min} max={stickerSize.max}
                value={selectedSticker.size} disabled={saving}
                onChange={event => {
                  const size = event.currentTarget.valueAsNumber
                  updateSticker(selectedSticker.id, sticker => ({ ...sticker, size }))
                }} /></label>
              <Button variant="ghost" disabled={saving} onClick={() => removeSticker(selectedSticker.id)}>선택한 스티커 삭제</Button>
            </div>
          )}
        </div>
      )}
      <div className={styles.preview}>
        <div className={styles.canvasFrame} hidden={Boolean(preview) || !images.length}>
          <canvas ref={canvasRef} className={mosaicMode ? styles.mosaicCanvas : undefined} width={COLLAGE_SIZE} height={COLLAGE_SIZE}
            role="img" aria-label="사진 배치 미리보기" onPointerDown={startMosaic} onPointerMove={moveMosaic}
            onPointerUp={finishMosaic} onPointerCancel={cancelMosaic} onLostPointerCapture={cancelMosaic} />
          <StickerLayer stickers={stickers} active={stickerMode && !preview && !saving}
            selectedId={selectedStickerId} onSelect={setSelectedStickerId} onUpdate={updateSticker} />
          {selection && <div className={styles.selection} aria-hidden="true" style={{
            left: `${selection.x / COLLAGE_SIZE * 100}%`, top: `${selection.y / COLLAGE_SIZE * 100}%`,
            width: `${selection.width / COLLAGE_SIZE * 100}%`, height: `${selection.height / COLLAGE_SIZE * 100}%`,
          }} />}
        </div>
        {preview && <img src={preview} width={COLLAGE_SIZE} height={COLLAGE_SIZE} alt="저장할 PNG 이미지" />}
        {!images.length && !error && <p role="status">미리보기를 만드는 중이에요.</p>}
      </div>
      {!preview && mosaicMode && (
        <details className={styles.coordinates}>
          <summary>숫자로 영역 지정</summary>
          <form onSubmit={applyForm} className={styles.coordinateFields}>
            <label>사진<select name="photo">{photos.map((photo, index) => <option key={photo.id} value={index}>{index + 1}. {photo.name}</option>)}</select></label>
            <label>왼쪽 (%)<input name="left" type="number" min="0" max="99" defaultValue="25" required /></label>
            <label>위쪽 (%)<input name="top" type="number" min="0" max="99" defaultValue="25" required /></label>
            <label>너비 (%)<input name="width" type="number" min="1" max="100" defaultValue="50" required /></label>
            <label>높이 (%)<input name="height" type="number" min="1" max="100" defaultValue="50" required /></label>
            <Button type="submit" disabled={!images.length || saving}>영역 적용</Button>
          </form>
        </details>
      )}
      {mosaicMessage && <p className={styles.meta} role="status">{mosaicMessage}</p>}
      <p className={styles.meta}>PNG · {COLLAGE_SIZE} × {COLLAGE_SIZE}</p>
      {error && <Notice>{error}</Notice>}
      <div className={styles.actions}>
        {preview ? <>
          <Button onClick={backToLayout}>배치로 돌아가기</Button>
          <a className={styles.download} href={preview} download="snaproom-collage.png">PNG 다운로드</a>
        </> : <>
          <Button onClick={onSelect} disabled={saving}>사진 선택으로 돌아가기</Button>
          <Button variant="primary" onClick={showExport} disabled={!images.length || saving}>{saving ? 'PNG 만드는 중' : '저장 미리보기'}</Button>
        </>}
      </div>
    </section>
  )
}

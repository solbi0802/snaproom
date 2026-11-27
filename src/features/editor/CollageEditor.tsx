import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, PointerEvent } from 'react'
import { COLLAGE_FRAME, COLLAGE_SIZE, collageCells, coverCrop, drawCollage, drawIndividualPhoto, photoPreviewSize } from '../../rendering/collage'
import type { CollagePhoto, Rect } from '../../rendering/collage'
import { intersect, rectangleBetween, toPhotoArea } from '../../rendering/mosaic'
import type { Point } from '../../rendering/mosaic'
import { drawStickers, placeSticker, stickerArt, stickerScale, stickerSize } from '../../rendering/stickers'
import type { Sticker, StickerKind } from '../../rendering/stickers'
import { Button } from '../../shared/ui/Button'
import { StickerLayer } from './StickerLayer'
import { CollageAppearanceControls } from './CollageAppearanceControls'
import type { CollageDocument, CollageEdit } from './collageHistory'
import { Notice } from '../../shared/ui/Notice'
import styles from './CollageEditor.module.css'

type Props = {
  photos: readonly { id: string; url: string; name: string; image?: HTMLImageElement }[]
  document: CollageDocument
  individual?: boolean
  canUndo: boolean
  onEdit: (edit: CollageEdit, group?: symbol) => void
  onUndo: () => void
  onSelect: () => void
  onExport: (exporting: boolean) => void
}

export function CollageEditor({ photos, document: collage, individual = false, canUndo, onEdit, onUndo, onSelect, onExport }: Props) {
  const { mosaics, stickers, background, gap } = collage
  const layout = photos.length < 3 ? 'grid' : collage.layout
  const heading = useRef<HTMLHeadingElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resultUrl = useRef<string | null>(null)
  const mounted = useRef(false)
  const [images, setImages] = useState<CollagePhoto[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [tool, setTool] = useState<'mosaic' | 'sticker' | null>(null)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [focusStickerId, setFocusStickerId] = useState<string | null>(null)
  const stickerTool = useRef<HTMLButtonElement>(null)
  const mosaicMode = tool === 'mosaic'
  const stickerMode = tool === 'sticker'
  const selectedSticker = stickers.find(sticker => sticker.id === selectedStickerId)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [mosaicMessage, setMosaicMessage] = useState('')
  const drag = useRef<{ pointerId: number; index: number; start: Point } | null>(null)
  const nativeWidth = individual ? images[0]?.image.naturalWidth ?? COLLAGE_SIZE : COLLAGE_SIZE
  const nativeHeight = individual ? images[0]?.image.naturalHeight ?? COLLAGE_SIZE : COLLAGE_SIZE
  const frame = useMemo(() => individual ? photoPreviewSize({ width: nativeWidth, height: nativeHeight }) : COLLAGE_FRAME,
    [individual, nativeWidth, nativeHeight])
  const cells = individual ? [{ x: 0, y: 0, ...frame }] : collageCells(photos.length, layout, gap)
  const imageStyle = individual ? { maxWidth: Math.min(440, 520 * nativeWidth / nativeHeight) } : undefined
  const name = photos[0]?.name.replace(/\.(?:jpe?g|png|webp|svg)$/i, '') || 'snaproom'
  const downloadName = individual ? name + '-edited.png' : 'snaproom-collage.png'
  const showingPreview = Boolean(preview)

  useEffect(() => {
    heading.current?.focus()
  }, [showingPreview])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void Promise.all(photos.map(async ({ id, url, image: decoded }) => {
      if (decoded) return { id, image: decoded }
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
      if (individual) drawIndividualPhoto(canvasRef.current, images[0], frame, mosaics)
      else drawCollage(canvasRef.current, images, layout, mosaics, { background, gap })
    } catch {
      // Report the failure through the same asynchronous path as image decoding.
      let active = true
      queueMicrotask(() => {
        if (active) setError('미리보기를 그릴 수 없어요. 사진 선택으로 돌아가 다시 시도해 주세요.')
      })
      return () => { active = false }
    }
  }, [images, layout, mosaics, background, gap, individual, frame])

  function applyMosaic(index: number, selection: Rect) {
    const photo = images[index]
    const cell = cells[index]
    if (!photo || !cell) return
    const clipped = intersect(selection, cell)
    if (!clipped || clipped.width < Math.min(8, cell.width / 10) || clipped.height < Math.min(8, cell.height / 10)) {
      setMosaicMessage('모자이크 영역을 조금 더 크게 선택해 주세요.')
      return
    }
    const { naturalWidth: width, naturalHeight: height } = photo.image
    const crop = individual ? { x: 0, y: 0, width, height } : coverCrop(width, height, cell)
    const area = toPhotoArea(clipped, cell, crop, width, height)
    onEdit(document => ({ ...document, mosaics: [...document.mosaics, { photoId: photo.id, area }] }))
    setMosaicMessage(individual ? '현재 사진에 모자이크를 적용했어요.' : `${index + 1}번 사진에 모자이크를 적용했어요.`)
  }

  function pointerPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * frame.width / bounds.width,
      y: (event.clientY - bounds.top) * frame.height / bounds.height,
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
    const index = individual ? 0 : Number(fields.get('photo'))
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

  function addSticker(kind: StickerKind, focusNewSticker: boolean) {
    const id = crypto.randomUUID()
    const scale = stickerScale(frame)
    const offset = (stickers.length % 6) * 24 * scale
    const sticker = placeSticker({ id, kind, x: frame.width / 2 + offset, y: frame.height / 2 + offset,
      size: stickerSize.initial * scale }, frame)
    onEdit(document => ({ ...document, stickers: [...document.stickers, sticker] }))
    setSelectedStickerId(id)
    setFocusStickerId(focusNewSticker ? id : null)
  }

  function updateSticker(id: string, update: (sticker: Sticker) => Sticker) {
    onEdit(document => {
      const sticker = document.stickers.find(item => item.id === id)
      if (!sticker) return document
      const next = placeSticker(update(sticker), frame)
      if (next.x === sticker.x && next.y === sticker.y && next.size === sticker.size) return document
      return { ...document, stickers: document.stickers.map(item => item.id === id ? next : item) }
    })
  }

  function removeSticker(id: string) {
    onEdit(document => ({ ...document, stickers: document.stickers.filter(sticker => sticker.id !== id) }))
    setSelectedStickerId(null)
    stickerTool.current?.focus()
  }

  function undo() {
    onUndo()
    setMosaicMessage('마지막 편집을 되돌렸어요.')
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (showingPreview || saving || !canUndo || event.defaultPrevented || event.altKey || event.shiftKey ||
      !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
    if (event.target instanceof HTMLElement && (event.target.isContentEditable ||
      event.target.closest('input, textarea, select'))) return
    event.preventDefault()
    undo()
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
      if (individual) drawIndividualPhoto(output, images[0], { width: nativeWidth, height: nativeHeight }, mosaics)
      else drawCollage(output, images, layout, mosaics, { background, gap })
      const context = output.getContext('2d')
      if (!context) { fail(); return }
      context.scale(nativeWidth / frame.width, nativeHeight / frame.height)
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
    <section className={styles.editor} aria-labelledby="collage-heading" onKeyDown={onEditorKeyDown}>
      <h1 id="collage-heading" ref={heading} tabIndex={-1}>{preview ? '저장 미리보기' : individual ? '개별 사진 편집' : '사진 배치'}</h1>
      {!preview && !individual && (
        <div className={styles.toolbar} role="group" aria-label="사진 레이아웃">
          <Button aria-pressed={layout === 'grid'} onClick={() => onEdit(document => document.layout === 'grid' ? document : { ...document, layout: 'grid' })} disabled={saving}>기본 배치</Button>
          <Button aria-pressed={layout === 'featured'} onClick={() => onEdit(document => document.layout === 'featured' ? document : { ...document, layout: 'featured' })} disabled={saving || photos.length < 3}>첫 사진 강조</Button>
        </div>
      )}
      {!preview && (
        <div className={styles.toolbar} role="group" aria-label="편집 도구">
          <Button aria-pressed={mosaicMode} disabled={!images.length || saving} onClick={() => setTool(mosaicMode ? null : 'mosaic')}>모자이크</Button>
          <Button ref={stickerTool} aria-pressed={stickerMode} disabled={!images.length || saving}
            onClick={() => setTool(stickerMode ? null : 'sticker')}>스티커</Button>
          <Button variant="ghost" disabled={!canUndo || saving} aria-keyshortcuts="Control+Z Meta+Z"
            onClick={undo}>실행 취소</Button>
          <Button variant="ghost" disabled={!mosaics.length || saving} onClick={() => {
            onEdit(document => ({ ...document, mosaics: document.mosaics.slice(0, -1) }))
            setMosaicMessage('마지막 모자이크를 지웠어요.')
          }}>마지막 모자이크 지우기</Button>
        </div>
      )}
      {!preview && !individual && <CollageAppearanceControls background={background} gap={gap}
        disabled={!images.length || saving} onEdit={onEdit} />}
      {!preview && mosaicMode && <p className={styles.meta}>사진 안에서 가릴 영역을 드래그하세요.</p>}
      {!preview && stickerMode && (
        <div className={styles.stickerControls}>
          <div className={styles.toolbar} role="group" aria-label="스티커 추가">
            {(Object.keys(stickerArt) as StickerKind[]).map(kind => (
              <Button key={kind} disabled={saving} onClick={event => addSticker(kind, event.detail === 0)}>
                <span aria-hidden="true" style={{ color: stickerArt[kind].color }}>{stickerArt[kind].symbol}</span>
                {stickerArt[kind].label} 추가
              </Button>
            ))}
          </div>
          <p id="sticker-instructions" className={styles.meta}>스티커를 끌어서 옮기고, 네 모서리 중 하나를 끌어서 크기를 바꿀 수 있어요.</p>
          {selectedSticker && (
            <Button variant="ghost" disabled={saving} onClick={() => removeSticker(selectedSticker.id)}>선택한 스티커 삭제</Button>
          )}
        </div>
      )}
      <div className={styles.preview}>
        <div className={styles.canvasFrame} style={imageStyle} hidden={Boolean(preview) || !images.length}>
          <canvas ref={canvasRef} className={mosaicMode ? styles.mosaicCanvas : undefined} width={frame.width} height={frame.height}
            role="img" aria-label={individual ? '개별 사진 미리보기' : '사진 배치 미리보기'} onPointerDown={startMosaic} onPointerMove={moveMosaic}
            onPointerUp={finishMosaic} onPointerCancel={cancelMosaic} onLostPointerCapture={cancelMosaic} />
          <StickerLayer stickers={stickers} frame={frame} active={stickerMode && !preview && !saving}
            selectedId={selectedStickerId} focusStickerId={focusStickerId} onSelect={setSelectedStickerId} onUpdate={updateSticker} />
          {selection && <div className={styles.selection} aria-hidden="true" style={{
            left: `${selection.x / frame.width * 100}%`, top: `${selection.y / frame.height * 100}%`,
            width: `${selection.width / frame.width * 100}%`, height: `${selection.height / frame.height * 100}%`,
          }} />}
        </div>
        {preview && <img src={preview} width={nativeWidth} height={nativeHeight} style={imageStyle} alt="저장할 PNG 이미지" />}
        {!images.length && !error && <p role="status">미리보기를 만드는 중이에요.</p>}
      </div>
      {!preview && mosaicMode && (
        <details className={styles.coordinates}>
          <summary>숫자로 영역 지정</summary>
          <form onSubmit={applyForm} className={styles.coordinateFields}>
            {!individual && <label>사진<select name="photo">{photos.map((photo, index) => <option key={photo.id} value={index}>{index + 1}. {photo.name}</option>)}</select></label>}
            <label>왼쪽 (%)<input name="left" type="number" min="0" max="99" defaultValue="25" required /></label>
            <label>위쪽 (%)<input name="top" type="number" min="0" max="99" defaultValue="25" required /></label>
            <label>너비 (%)<input name="width" type="number" min="1" max="100" defaultValue="50" required /></label>
            <label>높이 (%)<input name="height" type="number" min="1" max="100" defaultValue="50" required /></label>
            <Button type="submit" disabled={!images.length || saving}>영역 적용</Button>
          </form>
        </details>
      )}
      {mosaicMessage && <p className={styles.meta} role="status">{mosaicMessage}</p>}
      <p className={styles.meta}>PNG · {nativeWidth} × {nativeHeight}</p>
      {error && <Notice>{error}</Notice>}
      <div className={styles.actions}>
        {preview ? <>
          <Button onClick={backToLayout}>{individual ? '개별 편집으로 돌아가기' : '배치로 돌아가기'}</Button>
          <a className={styles.download} href={preview} download={downloadName}>PNG 다운로드</a>
        </> : <>
          <Button onClick={onSelect} disabled={saving}>사진 선택으로 돌아가기</Button>
          <Button variant="primary" onClick={showExport} disabled={!images.length || saving}>{saving ? 'PNG 만드는 중' : '저장 미리보기'}</Button>
        </>}
      </div>
    </section>
  )
}

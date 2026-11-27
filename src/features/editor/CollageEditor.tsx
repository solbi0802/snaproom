import { useEffect, useRef, useState } from 'react'
import { COLLAGE_SIZE, drawCollage } from '../../rendering/collage'
import type { Layout } from '../../rendering/collage'
import { Button } from '../../shared/ui/Button'
import { Notice } from '../../shared/ui/Notice'
import styles from './CollageEditor.module.css'

type Props = {
  photos: readonly { url: string }[]
  layout: Layout
  onLayout: (layout: Layout) => void
  onSelect: () => void
  onExport: (exporting: boolean) => void
}

export function CollageEditor({ photos, layout, onLayout, onSelect, onExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resultUrl = useRef<string | null>(null)
  const mounted = useRef(false)
  const [images, setImages] = useState<HTMLImageElement[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void Promise.all(photos.map(async ({ url }) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return image
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
      drawCollage(canvasRef.current, images, layout)
    } catch {
      // Report the failure through the same asynchronous path as image decoding.
      let active = true
      queueMicrotask(() => {
        if (active) setError('미리보기를 그릴 수 없어요. 사진 선택으로 돌아가 다시 시도해 주세요.')
      })
      return () => { active = false }
    }
  }, [images, layout])

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
      drawCollage(output, images, layout)
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
      <div className={styles.preview}>
        <canvas ref={canvasRef} width={COLLAGE_SIZE} height={COLLAGE_SIZE} hidden={Boolean(preview) || !images.length} role="img" aria-label="사진 배치 미리보기" />
        {preview && <img src={preview} width={COLLAGE_SIZE} height={COLLAGE_SIZE} alt="저장할 PNG 이미지" />}
        {!images.length && !error && <p role="status">미리보기를 만드는 중이에요.</p>}
      </div>
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

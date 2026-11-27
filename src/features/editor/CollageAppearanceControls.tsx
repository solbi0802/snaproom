import { useRef, useState } from 'react'
import { MAX_COLLAGE_GAP } from '../../rendering/collage'
import type { CollageAppearance } from '../../rendering/collage'
import type { CollageEdit } from './collageHistory'
import styles from './CollageEditor.module.css'

type Props = CollageAppearance & { disabled: boolean; onEdit: (edit: CollageEdit, group?: symbol) => void }
const channels = ['R', 'G', 'B'] as const

function RgbChannel({ label, value, disabled, onCommit }: {
  label: string; value: number; disabled: boolean; onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <label>{label}
      <input aria-label={`배경색 ${label}`} type="number" min="0" max="255" step="1" disabled={disabled}
        value={draft ?? value} onChange={event => setDraft(event.currentTarget.value)}
        onBlur={() => {
          if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) {
            onCommit(Math.max(0, Math.min(255, Math.round(Number(draft)))))
          }
          setDraft(null)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(null)
        }} />
    </label>
  )
}

export function CollageAppearanceControls({ background, gap, disabled, onEdit }: Props) {
  const colorGroup = useRef<symbol | undefined>(undefined)
  const gapGroup = useRef<symbol | undefined>(undefined)

  function setBackground(value: string, group?: symbol) {
    onEdit(document => document.background === value ? document : { ...document, background: value }, group)
  }

  function setChannel(index: number, value: number) {
    const start = 1 + index * 2
    const next = value.toString(16).padStart(2, '0')
    onEdit(document => {
      const current = document.background
      if (current.slice(start, start + 2) === next) return document
      return { ...document, background: current.slice(0, start) + next + current.slice(start + 2) }
    })
  }

  return (
    <div className={styles.appearance} role="group" aria-label="배경과 여백">
      <div className={styles.colorFields}>
        <label>배경색
          <input type="color" value={background} disabled={disabled}
            onPointerDown={() => { colorGroup.current = Symbol() }}
            onBlur={() => { colorGroup.current = undefined }}
            onChange={event => setBackground(event.currentTarget.value, colorGroup.current ??= Symbol())}
            onInput={event => setBackground(event.currentTarget.value, colorGroup.current ??= Symbol())} />
        </label>
        {channels.map((label, index) => (
          <RgbChannel key={label} label={label} value={parseInt(background.slice(1 + index * 2, 3 + index * 2), 16)}
            disabled={disabled} onCommit={value => setChannel(index, value)} />
        ))}
      </div>
      <label className={styles.gapField}>여백
        <input aria-label="사진 여백" type="range" min="0" max={MAX_COLLAGE_GAP} value={gap}
          aria-valuetext={`${gap} 픽셀`} disabled={disabled}
          onPointerDown={() => { gapGroup.current = Symbol() }}
          onPointerUp={() => { gapGroup.current = undefined }}
          onPointerCancel={() => { gapGroup.current = undefined }}
          onBlur={() => { gapGroup.current = undefined }}
          onKeyDown={event => { if (!event.repeat) gapGroup.current = Symbol() }}
          onChange={event => {
            const next = event.currentTarget.valueAsNumber
            onEdit(document => document.gap === next ? document : { ...document, gap: next }, gapGroup.current)
          }} />
        <span aria-hidden="true">{gap} px</span>
      </label>
    </div>
  )
}

import { COLLAGE_DEFAULTS } from '../../rendering/collage'
import type { CollageAppearance, Layout } from '../../rendering/collage'
import type { MosaicRegion } from '../../rendering/mosaic'
import type { Sticker } from '../../rendering/stickers'

export type CollageDocument = CollageAppearance & {
  layout: Layout
  mosaics: readonly MosaicRegion[]
  stickers: readonly Sticker[]
}

export type CollageEdit = (document: CollageDocument) => CollageDocument
export type CollageHistory = { document: CollageDocument; past: readonly CollageDocument[]; group?: symbol }
const historyLimit = 50

export const initialHistory: CollageHistory = {
  document: { ...COLLAGE_DEFAULTS, layout: 'grid', mosaics: [], stickers: [] },
  past: [],
}

export function recordEdit(history: CollageHistory, edit: CollageEdit, group?: symbol): CollageHistory {
  const document = edit(history.document)
  if (document === history.document) return history
  const past = group && group === history.group
    ? history.past
    : [...history.past.slice(1 - historyLimit), history.document]
  return { document, past, group }
}

export function undoEdit(history: CollageHistory): CollageHistory {
  const previous = history.past.at(-1)
  return previous ? { document: previous, past: history.past.slice(0, -1) } : history
}

export function forgetPhoto(history: CollageHistory, id: string): CollageHistory {
  const { document, past } = history
  const belongsToPhoto = (region: MosaicRegion) => region.photoId === id
  if (!document.mosaics.some(belongsToPhoto) && !past.some(snapshot => snapshot.mosaics.some(belongsToPhoto))) return history
  const snapshots = [...past, document].map(snapshot => ({
    ...snapshot,
    mosaics: snapshot.mosaics.filter(region => !belongsToPhoto(region)),
  }))
  const current = snapshots.pop()!
  const distinct = snapshots.filter((snapshot, index) => {
    const next = snapshots[index + 1] ?? current
    return snapshot.layout !== next.layout || snapshot.background !== next.background ||
      snapshot.gap !== next.gap || snapshot.stickers !== next.stickers ||
      snapshot.mosaics.length !== next.mosaics.length ||
      snapshot.mosaics.some((region, index) => region !== next.mosaics[index])
  })
  return { document: current, past: distinct }
}

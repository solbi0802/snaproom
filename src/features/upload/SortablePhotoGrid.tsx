import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, IconButton } from '../../shared/ui/Button'
import { Icon } from '../../shared/ui/Icon'
import styles from './SortablePhotoGrid.module.css'

type Photo = { id: string; name: string; url: string }
type PhotoActions = { onRemove: (id: string, keyboard: boolean) => void; onReplace: (id: string) => void }
type GridProps = PhotoActions & {
  photos: readonly Photo[]
  loading: boolean
  onReorder: (fromId: string, toId: string) => void
}

// Pointer drops outside the cards cancel. Keyboard sorting uses the card centers.
const detectCollision: CollisionDetection = args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)

export function SortablePhotoGrid({ photos, loading, onReorder, onRemove, onReplace }: GridProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short hold distinguishes sorting from scrolling on the photo grid.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const describe = (id: string | number) => photos.find(photo => photo.id === id)?.name ?? '사진'

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!loading && over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={detectCollision} onDragEnd={handleDragEnd} accessibility={{
      screenReaderInstructions: { draggable: '스페이스나 엔터로 사진을 잡고 방향키로 이동하세요. 스페이스나 엔터로 놓고, Esc로 취소할 수 있어요.' },
      announcements: {
        onDragStart: ({ active }) => `${describe(active.id)} 사진을 잡았어요.`,
        onDragOver: ({ over }) => over ? `${photos.findIndex(photo => photo.id === over.id) + 1}번째 위치예요.` : '사진 목록 밖이에요.',
        onDragEnd: ({ active, over }) => over && active.id !== over.id ? undefined : '사진 순서를 유지했어요.',
        onDragCancel: () => '사진 순서 변경을 취소했어요.',
      },
    }}>
      <SortableContext items={photos.map(photo => photo.id)} strategy={rectSortingStrategy}>
        <ul className={styles.grid}>
          {photos.map((photo, index) => (
            <SortablePhoto key={photo.id} photo={photo} index={index} loading={loading}
              canSort={photos.length > 1} onRemove={onRemove} onReplace={onReplace} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortablePhoto({ photo, index, loading, canSort, onRemove, onReplace }: PhotoActions & {
  photo: Photo
  index: number
  loading: boolean
  canSort: boolean
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id, disabled: loading || !canSort })

  return (
    <li ref={setNodeRef} className={styles.card} data-dragging={isDragging} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <Button variant="ghost" {...attributes} {...listeners} ref={setActivatorNodeRef}
        className={styles.sortSurface} aria-label={`${photo.name} 순서 변경`} disabled={loading || !canSort} />
      <div className={styles.thumbnail}>
        <img src={photo.url} alt={photo.name} draggable={false} />
        <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
        <IconButton className={styles.remove} label={`${photo.name} 제거`} disabled={loading} onClick={event => onRemove(photo.id, event.detail === 0)}>
          <Icon name="close" />
        </IconButton>
      </div>
      <div className={styles.meta}>{photo.name}</div>
      <div className={styles.actions}>
        <Button variant="ghost" aria-label={`${photo.name} 교체`} disabled={loading} onClick={() => onReplace(photo.id)}>교체</Button>
      </div>
    </li>
  )
}

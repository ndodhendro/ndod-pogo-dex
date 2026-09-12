import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { SpecimenTagSheet } from '../components/TagSheet'
import { TagChip } from '../components/TagChip'
import {
  categoryForTag,
  colorForCategory,
  iconForCategory,
  lookForTag,
  SEEN_ICON,
  sortSpecimenTags,
  specimenTagChoices,
  toneForCategory,
} from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity } from '../lib/covers'
import { deleteSpecimen, reorderGallerySpecimens, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { sameCategoryOrder } from '../lib/categoryOrder'
import { db, type CategoryRow, type SpecimenRow } from '../lib/db'
import {
  applyVisibleGalleryOrder,
  galleryItemShift,
  galleryTargetIndex,
  mergeGalleryDraft,
  moveVisibleGalleryId,
  sortGallerySpecimens,
  type GallerySlot,
} from '../lib/galleryOrder'
import { listNeighbor } from '../lib/previewSwipe'
import { toastAfterWrite, useToast } from '../lib/toast'
import {
  hasAllRequired,
  isSilhouette,
  labelForTag,
  specimenTags,
  toggleRequiredTags,
  type TagId,
} from '../lib/tags'
import { specimenMatchesDexFilters } from '../lib/dexGrid'
import styles from './Gallery.module.css'

const EMPTY_CATEGORIES: CategoryRow[] = []
const HOLD_MS = 500
const HOLD_LOCK = 10

export function GalleryPage() {
  const { categoryId, speciesId } = useParams()
  const { showToast } = useToast()
  const species = SPECIES_BY_ID.get(Number(speciesId))
  const category = useLiveQuery(
    () => (categoryId ? db.categories.get(categoryId) : undefined),
    [categoryId],
  )
  const categories =
    useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? EMPTY_CATEGORIES
  const specimens =
    useLiveQuery(
      () => db.specimens.where('speciesId').equals(Number(speciesId)).toArray(),
      [speciesId],
    ) ?? []
  const coverRows =
    useLiveQuery(
      () =>
        categoryId && speciesId
          ? db.covers.where('[categoryId+speciesId]').equals([categoryId, Number(speciesId)]).toArray()
          : [],
      [categoryId, speciesId],
    ) ?? []
  const [preview, setPreview] = useState<SpecimenRow | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const [filterTags, setFilterTags] = useState<TagId[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftIds, setDraftIds] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [targetIndex, setTargetIndex] = useState(0)
  const [delta, setDelta] = useState({ x: 0, y: 0 })
  const gridRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    target: HTMLButtonElement
    timer: number
  } | null>(null)
  const dragRef = useRef<{
    id: string
    pointerId: number
    originVisible: string[]
    originIndex: number
    startX: number
    startY: number
    slots: GallerySlot[]
    targetIndex: number
  } | null>(null)
  const ignoreClickRef = useRef(false)
  const savingRef = useRef(false)
  const orderedIdsRef = useRef<string[]>([])
  const liveIdsRef = useRef<string[]>([])
  const orderedRef = useRef<SpecimenRow[]>([])
  const visibleIdsRef = useRef<string[]>([])

  const liveSorted = useMemo(
    () => sortGallerySpecimens(specimens, categories),
    [specimens, categories],
  )
  const liveIds = useMemo(() => liveSorted.map((row) => row.id), [liveSorted])
  const orderedIds = draftIds ?? liveIds
  const ordered = useMemo(() => {
    const byId = new Map(liveSorted.map((row) => [row.id, row]))
    return orderedIds.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  }, [orderedIds, liveSorted])
  const visible = useMemo(
    () => ordered.filter((row) => specimenMatchesDexFilters(row, filterTags)),
    [ordered, filterTags],
  )
  const visibleIds = useMemo(() => visible.map((row) => row.id), [visible])
  orderedIdsRef.current = orderedIds
  liveIdsRef.current = liveIds
  orderedRef.current = ordered
  visibleIdsRef.current = visibleIds
  const display = useMemo(() => {
    const originIds = dragId && dragRef.current ? dragRef.current.originVisible : visibleIds
    const byId = new Map(ordered.map((row) => [row.id, row]))
    return originIds.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  }, [dragId, visibleIds, ordered])
  const nextVisibleIds =
    dragId && dragRef.current
      ? moveVisibleGalleryId(dragRef.current.originVisible, dragId, targetIndex)
      : visibleIds
  const filtering = filterTags.length > 0
  const tagFilters = useMemo(() => specimenTagChoices(categories).filter((choice) => choice.tag != null), [categories])
  const previewIndex = preview ? visible.findIndex((row) => row.id === preview.id) : -1
  const previewNext = listNeighbor(visible, previewIndex, 1)
  const previewPrev = listNeighbor(visible, previewIndex, -1)
  const previewUrl = useImageUrl(preview?.imageId, 'original')
  const nextUrl = useImageUrl(previewNext?.imageId, 'original')
  const prevUrl = useImageUrl(previewPrev?.imageId, 'original')

  useEffect(() => {
    if (dragRef.current || savingRef.current) return
    const next = draftIds ? mergeGalleryDraft(draftIds, liveIds) : liveIds
    if (draftIds && sameCategoryOrder(next, liveIds)) {
      setDraftIds(null)
      return
    }
    if (draftIds && !sameCategoryOrder(next, draftIds)) setDraftIds(next)
  }, [draftIds, liveIds])

  useEffect(
    () => () => {
      const press = pressRef.current
      if (press) window.clearTimeout(press.timer)
    },
    [],
  )

  useEffect(() => {
    function onTouchMove(event: TouchEvent) {
      if (dragRef.current) event.preventDefault()
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => window.removeEventListener('touchmove', onTouchMove)
  }, [])

  if (!species) return <p className="empty-state">Unknown species.</p>

  function persistOrder(nextFullIds: string[]) {
    if (sameCategoryOrder(nextFullIds, liveIdsRef.current)) return
    savingRef.current = true
    setDraftIds(nextFullIds)
    void reorderGallerySpecimens(Number(speciesId), nextFullIds)
      .then((cloudError) => toastAfterWrite(showToast, 'Gallery order saved', cloudError))
      .catch((err) => {
        setDraftIds(null)
        showToast(err instanceof Error ? err.message : 'Could not reorder')
      })
      .finally(() => {
        savingRef.current = false
      })
  }

  function clearPress() {
    const press = pressRef.current
    if (press) window.clearTimeout(press.timer)
    pressRef.current = null
  }

  function startDrag(target: HTMLButtonElement, id: string, pointerId: number, startX: number, startY: number) {
    clearPress()
    if (dragRef.current || savingRef.current || visibleIdsRef.current.length < 2) return
    const grid = gridRef.current
    if (!grid) return
    if (!target.hasPointerCapture(pointerId)) {
      try {
        target.setPointerCapture(pointerId)
      } catch {
        return
      }
    }
    const originVisible = visibleIdsRef.current
    const originIndex = originVisible.indexOf(id)
    if (originIndex < 0) return
    const slots = [...grid.querySelectorAll<HTMLElement>('[data-gallery-id]')].map((el) => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    })
    dragRef.current = {
      id,
      pointerId,
      originVisible,
      originIndex,
      startX,
      startY,
      slots,
      targetIndex: originIndex,
    }
    ignoreClickRef.current = true
    setDragId(id)
    setTargetIndex(originIndex)
    setDelta({ x: 0, y: 0 })
  }

  function moveDrag(clientX: number, clientY: number) {
    const drag = dragRef.current
    if (!drag) return
    const nextIndex = galleryTargetIndex(drag.slots, clientX, clientY)
    drag.targetIndex = nextIndex
    setDelta({ x: clientX - drag.startX, y: clientY - drag.startY })
    setTargetIndex(nextIndex)
  }

  function finishDrag() {
    clearPress()
    const drag = dragRef.current
    if (!drag) return
    const nextVisible = moveVisibleGalleryId(drag.originVisible, drag.id, drag.targetIndex)
    dragRef.current = null
    setDragId(null)
    setTargetIndex(0)
    setDelta({ x: 0, y: 0 })
    ignoreClickRef.current = true
    const byId = new Map(orderedRef.current.map((row) => [row.id, row]))
    const fullSorted = orderedIdsRef.current.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
    try {
      persistOrder(applyVisibleGalleryOrder(fullSorted, nextVisible).map((row) => row.id))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reorder')
    }
  }

  function onCardPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || savingRef.current || dragRef.current || preview) return
    if (visibleIdsRef.current.length < 2) return
    ignoreClickRef.current = false
    clearPress()
    const target = event.currentTarget
    pressRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      target,
      timer: window.setTimeout(() => {
        const press = pressRef.current
        if (!press || press.id !== id) return
        startDrag(press.target, id, press.pointerId, press.lastX, press.lastY)
      }, HOLD_MS),
    }
  }

  function onCardPointerMove(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (dragRef.current) {
      event.preventDefault()
      moveDrag(event.clientX, event.clientY)
      return
    }
    const press = pressRef.current
    if (!press || press.id !== id || press.pointerId !== event.pointerId) return
    press.lastX = event.clientX
    press.lastY = event.clientY
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) >= HOLD_LOCK) {
      clearPress()
    }
  }

  function onCardPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragRef.current) finishDrag()
    else clearPress()
  }

  return (
    <section>
      <p className="page-sub">
        <Link
          to={`/dex/${categoryId}`}
          data-tone={category ? toneForCategory(category) : 'dex'}
          style={category ? categoryChromeStyle(colorForCategory(category)) : undefined}
        >
          ←{' '}
          {category ? (
            <>
              <span aria-hidden="true">{iconForCategory(category)} </span>
              {category.name}
            </>
          ) : (
            'Pokédex'
          )}
        </Link>
      </p>
      <h1 className="page-title">{species.name}</h1>
      <p className="page-sub">
        {filtering
          ? `${visible.length} of ${specimens.length} specimen${specimens.length === 1 ? '' : 's'}`
          : `${specimens.length} specimen${specimens.length === 1 ? '' : 's'}`}
      </p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`btn ${styles.toolBtn}`}
          data-tone={category ? toneForCategory(category) : 'dex'}
          data-on={filtering ? 'true' : 'false'}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          <span aria-hidden="true">🏷️</span>
          Filters
          {filtering ? <span className={styles.badge}>{filterTags.length}</span> : null}
        </button>
      </div>
      {specimens.length === 0 ? (
        <p className="empty-state">No screenshots for this species yet.</p>
      ) : visible.length === 0 ? (
        <p className="empty-state">No matching tags.</p>
      ) : (
        <div ref={gridRef} className={styles.grid} data-reordering={dragId ? 'true' : 'false'}>
          {display.map((specimen, originIndex) => {
            const dragging = dragId === specimen.id
            const shift =
              dragging || !dragId || !dragRef.current
                ? { x: 0, y: 0 }
                : galleryItemShift(
                    originIndex,
                    nextVisibleIds.indexOf(specimen.id),
                    dragRef.current.slots,
                  )
            return (
              <GalleryCard
                key={specimen.id}
                specimen={specimen}
                categories={categories}
                isCover={coverRows.some((row) => row.specimenId === specimen.id)}
                purity={
                  coverRows.some((row) => row.specimenId === specimen.id) && category
                    ? coverPurity(
                        specimenTags(specimen),
                        category.requiredTags,
                        isSilhouette(specimen),
                        specimen.speciesId,
                        specimen.gender,
                      )
                    : null
                }
                dragging={dragging}
                shift={dragging ? delta : shift}
                onOpen={() => {
                  if (ignoreClickRef.current) {
                    ignoreClickRef.current = false
                    return
                  }
                  setPreview(specimen)
                }}
                onPointerDown={(event) => onCardPointerDown(event, specimen.id)}
                onPointerMove={(event) => onCardPointerMove(event, specimen.id)}
                onPointerUp={onCardPointerUp}
              />
            )
          })}
        </div>
      )}
      {preview && category ? (
        <CardPreview
          specimen={preview}
          imageUrl={previewUrl ?? ''}
          prev={previewPrev ? { specimen: previewPrev, imageUrl: prevUrl ?? '' } : undefined}
          next={previewNext ? { specimen: previewNext, imageUrl: nextUrl ?? '' } : undefined}
          canSetCover={hasAllRequired(specimenTags(preview), category.requiredTags)}
          requiredTags={category.requiredTags}
          locked={editingTags}
          onClose={() => {
            setEditingTags(false)
            setPreview(null)
          }}
          onNext={previewNext ? () => setPreview(previewNext) : undefined}
          onPrev={previewPrev ? () => setPreview(previewPrev) : undefined}
          onEditTags={() => setEditingTags(true)}
          onSetCover={() => {
            void setAsCover(category.id, preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Cover updated', cloudError)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not set cover'))
          }}
          onOpenGallery={() => {
            setEditingTags(false)
            setPreview(null)
          }}
          onDelete={() =>
            deleteSpecimen(preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Specimen deleted', cloudError)
                setEditingTags(false)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not delete'))
          }
        />
      ) : null}
      <SpecimenTagSheet
        specimen={editingTags ? preview : null}
        onClose={() => setEditingTags(false)}
        onSaved={(specimen) => {
          setEditingTags(false)
          if (specimen.speciesId !== Number(speciesId) || !hasAllRequired(specimenTags(specimen), filterTags)) {
            setPreview(null)
            return
          }
          setPreview(specimen)
        }}
      />
      <BottomSheet
        open={filtersOpen}
        title="Filters"
        showClose={false}
        onClose={() => setFiltersOpen(false)}
        headerAction={
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!filtering}
            onClick={() => setFilterTags([])}
          >
            <span aria-hidden="true">✖️</span>
            Clear
          </button>
        }
      >
        <p className="page-sub">Show screenshots that have every selected tag.</p>
        <div className="chip-row">
          {tagFilters.map((choice) => {
            const tag = choice.tag as TagId
            return (
              <TagChip
                key={tag}
                tag={tag}
                selected={filterTags.includes(tag)}
                icon={choice.icon}
                label={choice.label}
                labelColor={choice.labelColor}
                onClick={() => setFilterTags((tags) => toggleRequiredTags(tags, [tag]))}
              />
            )
          })}
        </div>
      </BottomSheet>
    </section>
  )
}

function galleryTagLabel(tag: TagId, specimen: SpecimenRow, categories: CategoryRow[]) {
  const named = categoryForTag(categories, tag)?.name
  if (tag === 'costume') return specimen.costume || named || labelForTag(tag)
  if (tag === 'background') return specimen.background || named || labelForTag(tag)
  return named || labelForTag(tag)
}

function GalleryCard({
  specimen,
  categories,
  isCover,
  purity,
  dragging,
  shift,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  specimen: SpecimenRow
  categories: CategoryRow[]
  isCover: boolean
  purity: ReturnType<typeof coverPurity>
  dragging: boolean
  shift: { x: number; y: number }
  onOpen: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const url = useImageUrl(specimen.imageId, 'thumb')
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const tags = sortSpecimenTags(specimenTags(specimen), categories)
  const items = [
    ...tags.map((tag) => {
      const look = lookForTag(tag, categories)
      return {
        tag,
        icon: look.emoji,
        label: galleryTagLabel(tag, specimen, categories),
        labelColor: look.labelColor,
      }
    }),
    ...(isSilhouette(specimen)
      ? [{ tag: 'silhouette', icon: SEEN_ICON, label: 'Seen', labelColor: undefined as string | undefined }]
      : []),
  ]
  return (
    <div
      className={styles.cell}
      data-gallery-id={specimen.id}
      data-dragging={dragging ? 'true' : 'false'}
      style={
        dragging
          ? { transform: `translate(${shift.x}px, ${shift.y}px) scale(1.04)` }
          : shift.x !== 0 || shift.y !== 0
            ? { transform: `translate(${shift.x}px, ${shift.y}px)` }
            : undefined
      }
    >
      <DexCard
        name={isCover ? 'Cover' : species?.name ?? 'Specimen'}
        number={specimen.speciesId}
        thumbUrl={url}
        purity={purity}
        filled
        grabbed={dragging}
        onClick={onOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      />
      {items.length > 0 ? (
        <div className={styles.tags}>
          {items.map((item) => (
            <TagChip
              key={item.tag}
              tag={item.tag}
              selected
              size="sm"
              fill
              expanded={expandedTag === item.tag}
              icon={item.icon}
              label={item.label}
              labelColor={item.labelColor}
              onClick={() =>
                setExpandedTag((current) => (current === item.tag ? null : item.tag))
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

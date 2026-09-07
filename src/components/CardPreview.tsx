import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, lookForTag } from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { db, type SpecimenRow } from '../lib/db'
import {
  previewCarouselSettleX,
  previewCloseSettleY,
  previewSwipeAxis,
  previewSwipeCommit,
  previewSwipeOffset,
  type PreviewSwipeAction,
  type PreviewSwipeAxis,
} from '../lib/previewSwipe'
import { specimenTags, labelForTag } from '../lib/tags'
import { TagChip } from './TagChip'
import styles from './CardPreview.module.css'

export type PreviewSlide = {
  specimen: SpecimenRow
  imageUrl: string
}

type Props = {
  specimen: SpecimenRow
  imageUrl: string
  prev?: PreviewSlide | null
  next?: PreviewSlide | null
  canSetCover: boolean
  locked?: boolean
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  onEditTags: () => void
  onSetCover: () => void
  onOpenGallery: () => void
  onDelete: () => void | Promise<void>
}

export function CardPreview({
  specimen,
  imageUrl,
  prev,
  next,
  canSetCover,
  locked = false,
  onClose,
  onNext,
  onPrev,
  onEditTags,
  onSetCover,
  onOpenGallery,
  onDelete,
}: Props) {
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  const tags = specimenTags(specimen)
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const photoRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const axisRef = useRef<PreviewSwipeAxis>(null)
  const deltaRef = useRef({ dx: 0, dy: 0 })
  const settlingRef = useRef<PreviewSwipeAction>(null)
  const skipSpecimenReset = useRef(false)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [settling, setSettling] = useState<'next' | 'prev' | 'close-up' | 'close-down' | null>(null)
  const [snap, setSnap] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lightboxStart = useRef<{ x: number; y: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canNext = Boolean(onNext)
  const canPrev = Boolean(onPrev)
  const closing = settling === 'close-up' || settling === 'close-down'
  const swiping = !locked && !confirmDelete && !settling && !lightbox

  const finishClose = useCallback(() => {
    if (settlingRef.current !== 'close-up' && settlingRef.current !== 'close-down') return
    settlingRef.current = null
    onClose()
  }, [onClose])

  const beginClose = useCallback(
    (action: 'close-up' | 'close-down', fromY = 0) => {
      if (settlingRef.current) return
      const settleY = previewCloseSettleY(action, window.innerHeight)
      if (
        settleY == null ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        Math.abs(fromY - settleY) < 2
      ) {
        onClose()
        return
      }
      settlingRef.current = action
      setSettling(action)
      setDrag({ x: 0, y: fromY })
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (settlingRef.current !== action) return
          setDrag({ x: 0, y: settleY })
        })
      })
    },
    [onClose],
  )

  useEffect(() => {
    if (skipSpecimenReset.current) {
      skipSpecimenReset.current = false
      return
    }
    setConfirmDelete(false)
    setDeleting(false)
    setLightbox(false)
    setDrag({ x: 0, y: 0 })
    setSettling(null)
    startRef.current = null
    axisRef.current = null
    deltaRef.current = { dx: 0, dy: 0 }
    settlingRef.current = null
  }, [specimen.id])

  useEffect(() => {
    if (!snap) return
    const id = window.requestAnimationFrame(() => setSnap(false))
    return () => window.cancelAnimationFrame(id)
  }, [snap])

  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(finishClose, 500)
    return () => window.clearTimeout(id)
  }, [closing, finishClose])

  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (lightbox) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setLightbox(false)
        }
        return
      }
      if (e.key === 'Escape' || e.key === 'ArrowUp') {
        e.preventDefault()
        beginClose('close-up')
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        beginClose('close-down')
      }
      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, lightbox, beginClose, onNext, onPrev])

  useEffect(() => {
    const el = photoRef.current
    if (!el) return
    const onTouchMove = (event: TouchEvent) => {
      if (axisRef.current) event.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!swiping || e.button !== 0) return
    startRef.current = { x: e.clientX, y: e.clientY }
    axisRef.current = null
    deltaRef.current = { dx: 0, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    deltaRef.current = { dx, dy }
    if (!axisRef.current) axisRef.current = previewSwipeAxis(dx, dy)
    if (!axisRef.current) return
    setDrag(previewSwipeOffset(axisRef.current, dx, dy, canPrev, canNext))
  }

  function finishSettle(action: 'next' | 'prev') {
    skipSpecimenReset.current = true
    settlingRef.current = null
    setSettling(null)
    setSnap(true)
    setDrag({ x: 0, y: 0 })
    if (action === 'next') onNext?.()
    else onPrev?.()
  }

  function carouselStep() {
    const wrap = photoRef.current
    const track = wrap?.firstElementChild
    const slide = track?.firstElementChild
    const width = (slide instanceof HTMLElement ? slide.getBoundingClientRect().width : wrap?.getBoundingClientRect().width) ?? 0
    const gap =
      track instanceof HTMLElement ? Number.parseFloat(getComputedStyle(track).gap) || 0 : 0
    return { width, gap }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const wasSwipe = Boolean(axisRef.current)
    const action = previewSwipeCommit(
      axisRef.current,
      deltaRef.current.dx,
      deltaRef.current.dy,
      canPrev,
      canNext,
    )
    startRef.current = null
    axisRef.current = null
    deltaRef.current = { dx: 0, dy: 0 }
    if (action === 'close-up' || action === 'close-down') {
      beginClose(action, drag.y)
      return
    }
    if (action === 'next' || action === 'prev') {
      const { width, gap } = carouselStep()
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const settleX = previewCarouselSettleX(action, width, gap)
      if (reduceMotion || settleX == null || width < 1 || Math.abs(drag.x - settleX) < 2) {
        finishSettle(action)
        return
      }
      settlingRef.current = action
      setSettling(action)
      setDrag({ x: settleX, y: 0 })
      return
    }
    setDrag({ x: 0, y: 0 })
    if (!wasSwipe && imageUrl) setLightbox(true)
  }

  function onTrackTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'transform') return
    if (e.target !== e.currentTarget) return
    const action = settlingRef.current
    if (action === 'next' || action === 'prev') finishSettle(action)
  }

  function onSheetTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'transform') return
    if (e.target !== e.currentTarget) return
    finishClose()
  }

  function onLightboxPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    lightboxStart.current = { x: e.clientX, y: e.clientY }
  }

  function onLightboxPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = lightboxStart.current
    lightboxStart.current = null
    if (!start) return
    if (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10) return
    setLightbox(false)
  }

  async function confirmRemove() {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  const dragging = drag.x !== 0 || drag.y !== 0
  const trackDragging = dragging && !settling && drag.y === 0

  return (
    <div
      className={styles.backdrop}
      data-closing={closing ? 'true' : undefined}
      onClick={locked ? undefined : () => beginClose('close-down')}
      role="presentation"
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Specimen preview"
        data-dragging={drag.y !== 0 && !settling ? 'true' : undefined}
        data-closing={closing ? 'true' : undefined}
        style={{ transform: `translateY(${drag.y}px)` }}
        onTransitionEnd={onSheetTransitionEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={photoRef}
          className={styles.photoWrap}
          onPointerDown={swiping ? onPointerDown : undefined}
          onPointerMove={swiping ? onPointerMove : undefined}
          onPointerUp={swiping ? endPointer : undefined}
          onPointerCancel={swiping ? endPointer : undefined}
        >
          <div
            className={styles.photoTrack}
            data-dragging={trackDragging ? 'true' : undefined}
            data-instant={snap ? 'true' : undefined}
            style={{ transform: `translateX(calc(-100% - var(--carousel-gap) + ${drag.x}px))` }}
            onTransitionEnd={onTrackTransitionEnd}
          >
            <PreviewPhoto key={prev?.specimen.id ?? 'prev'} slide={prev} />
            <PreviewPhoto key={specimen.id} slide={{ specimen, imageUrl }} />
            <PreviewPhoto key={next?.specimen.id ?? 'next'} slide={next} />
          </div>
        </div>
        <div className={styles.meta}>
          <p className={styles.number}>#{String(specimen.speciesId).padStart(4, '0')}</p>
          <h2>{species?.name ?? 'Unknown'}</h2>
          {specimen.form ? <p className={styles.form}>{specimen.form}</p> : null}
          <div className="chip-row">
            {tags.map((tag) => {
              const look = lookForTag(tag, categories)
              const named = categoryForTag(categories, tag)?.name
              const extra =
                tag === 'costume'
                  ? specimen.costume || named || labelForTag(tag)
                  : tag === 'background'
                    ? specimen.background || named || labelForTag(tag)
                    : named || labelForTag(tag)
              return (
                <TagChip
                  key={tag}
                  tag={tag}
                  selected
                  icon={look.emoji}
                  label={extra}
                  labelColor={look.labelColor}
                />
              )
            })}
          </div>
        </div>
        {confirmDelete ? (
          <>
            <p className="page-sub">
              Remove this specimen from the collection? The screenshot will be gone.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className="btn"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={() => void confirmRemove()}
              >
                <span aria-hidden="true">🗑️</span>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSetCover}
              onClick={onSetCover}
            >
              Set as cover
            </button>
            <button type="button" className="btn" onClick={onOpenGallery}>
              Species gallery
            </button>
            <button type="button" className="btn" onClick={onEditTags}>
              <span aria-hidden="true">🏷️</span>
              Edit tags
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <span aria-hidden="true">🗑️</span>
              Delete
            </button>
          </div>
        )}
      </div>
      {lightbox && imageUrl ? (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Original screenshot"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation()
            onLightboxPointerDown(e)
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            onLightboxPointerUp(e)
          }}
          onPointerCancel={() => {
            lightboxStart.current = null
          }}
        >
          <img src={imageUrl} alt={species?.name ?? ''} draggable={false} />
        </div>
      ) : null}
    </div>
  )
}

function PreviewPhoto({ slide }: { slide?: PreviewSlide | null }) {
  const tags = slide ? specimenTags(slide.specimen) : []
  const name = slide ? SPECIES_BY_ID.get(slide.specimen.speciesId)?.name : undefined
  return (
    <div className={styles.slide}>
      <div
        className={styles.photo}
        data-shadow={tags.includes('shadow') ? 'true' : 'false'}
        data-purified={tags.includes('purified') ? 'true' : 'false'}
      >
        {slide?.imageUrl ? (
          <img src={slide.imageUrl} alt={name ?? 'Specimen'} draggable={false} />
        ) : null}
        {tags.includes('shiny') ? (
          <>
            <span className={styles.shine} />
            <span className={styles.sparkles} />
          </>
        ) : null}
        {tags.includes('hundo') ? <span className={styles.hundo} /> : null}
      </div>
    </div>
  )
}

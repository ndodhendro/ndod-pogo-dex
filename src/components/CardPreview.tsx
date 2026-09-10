import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, lookForTag, SEEN_ICON } from '../data/navIcons'
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
import { coverPurity } from '../lib/covers'
import { isSilhouette, specimenTags, labelForTag, type TagId } from '../lib/tags'
import { usePreviewAnimations } from '../lib/previewPrefs'
import { BottomSheet } from './BottomSheet'
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
  requiredTags?: TagId[]
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
  requiredTags = [],
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
  const previewAnimations = usePreviewAnimations()
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
      if (confirmDelete) return
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
  }, [locked, lightbox, confirmDelete, beginClose, onNext, onPrev])

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
  const carousel = trackDragging || settling === 'next' || settling === 'prev'
  const showFx = previewAnimations
  const animatePreview =
    showFx &&
    (typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const showAura = showFx && !carousel
  const purity = coverPurity(
    tags,
    requiredTags,
    isSilhouette(specimen),
    specimen.speciesId,
    specimen.gender,
  )

  return (
    <>
    <div
      className={styles.backdrop}
      data-closing={closing ? 'true' : undefined}
      onClick={locked || confirmDelete ? undefined : () => beginClose('close-down')}
      role="presentation"
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Specimen preview"
        data-dragging={drag.y !== 0 && !settling ? 'true' : undefined}
        data-closing={closing ? 'true' : undefined}
        data-preview-fx={showFx ? 'on' : 'off'}
        style={{ transform: `translateY(${drag.y}px)` }}
        onTransitionEnd={onSheetTransitionEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={photoRef}
          className={styles.photoWrap}
          data-carousel={carousel ? 'true' : undefined}
          onPointerDown={swiping ? onPointerDown : undefined}
          onPointerMove={swiping ? onPointerMove : undefined}
          onPointerUp={swiping ? endPointer : undefined}
          onPointerCancel={swiping ? endPointer : undefined}
        >
          {showAura && tags.includes('shadow') ? (
            <TagAura specimenId={specimen.id} tone="shadow" animate={animatePreview} />
          ) : null}
          {showAura && tags.includes('purified') ? (
            <TagAura specimenId={specimen.id} tone="purified" animate={animatePreview} />
          ) : null}
          <div
            className={styles.photoTrack}
            data-dragging={trackDragging ? 'true' : undefined}
            data-instant={snap ? 'true' : undefined}
            style={{ transform: `translateX(calc(-100% - var(--carousel-gap) + ${drag.x}px))` }}
            onTransitionEnd={onTrackTransitionEnd}
          >
            <PreviewPhoto
              key={prev?.specimen.id ?? 'prev'}
              slide={prev}
              requiredTags={requiredTags}
              showFx={showFx}
            />
            <PreviewPhoto
              key={specimen.id}
              slide={{ specimen, imageUrl }}
              requiredTags={requiredTags}
              showFx={showFx}
            />
            <PreviewPhoto
              key={next?.specimen.id ?? 'next'}
              slide={next}
              requiredTags={requiredTags}
              showFx={showFx}
            />
          </div>
        </div>
        <div className={styles.meta} data-purity={showFx ? undefined : (purity ?? '')}>
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
            {isSilhouette(specimen) ? (
              <TagChip tag="silhouette" selected icon={SEEN_ICON} label="Seen" />
            ) : null}
          </div>
        </div>
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
    <BottomSheet
      open={confirmDelete}
      nested
      showClose={false}
      title="Delete specimen"
      onClose={() => {
        if (deleting) return
        setConfirmDelete(false)
      }}
    >
      <p className={`page-sub ${styles.confirmCopy}`}>
        Delete this specimen from the collection? The screenshot will be gone.
      </p>
      <div className="row-actions">
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
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </BottomSheet>
    </>
  )
}

function TagAura({
  specimenId,
  tone,
  animate,
}: {
  specimenId: string
  tone: 'shadow' | 'purified'
  animate: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const filterId = `tag-flame-${tone}-${specimenId}-${uid}`
  const offsetRef = useRef<SVGFEOffsetElement>(null)
  const tile = 80

  useEffect(() => {
    const node = offsetRef.current
    if (!node || !animate) return
    const durationMs = 7080
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = ((now - started) / durationMs) % 1
      node.setAttribute('dy', String(-tile * t))
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [animate, tile])

  return (
    <span className={styles.tagAura} data-tone={tone} aria-hidden="true">
      <svg className={styles.flame} overflow="visible">
        <defs>
          <filter
            id={filterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.11 0.11"
              numOctaves="3"
              seed="3"
              stitchTiles="stitch"
              x="0"
              y="0"
              width={tile}
              height={tile}
              result="unit"
            />
            <feTile in="unit" x="-50%" y="-80%" width="200%" height="260%" result="period" />
            <feOffset
              ref={offsetRef}
              in="period"
              dx="0"
              dy="0"
              x="-50%"
              y="-80%"
              width="200%"
              height="260%"
              result="shifted"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="shifted"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="1.15" />
          </filter>
        </defs>
        <rect
          className={styles.flameEmber}
          x="22"
          y="22"
          width="calc(100% - 44px)"
          height="calc(100% - 44px)"
          filter={`url(#${filterId})`}
        />
        <rect
          className={styles.flameTip}
          x="22"
          y="22"
          width="calc(100% - 44px)"
          height="calc(100% - 44px)"
          filter={`url(#${filterId})`}
        />
      </svg>
    </span>
  )
}

function ShinySparkles() {
  return (
    <span className={styles.shinyLayer} aria-hidden="true">
      {SHINY_SPARKLES.map((sparkle, i) => (
        <span
          key={i}
          className={styles.sparkleStar}
          data-gold={sparkle.gold ? 'true' : undefined}
          style={
            {
              '--sparkle-x': sparkle.x,
              '--sparkle-y': sparkle.y,
              '--sparkle-size': `${sparkle.size}px`,
              '--sparkle-dur': sparkle.dur,
              '--sparkle-delay': sparkle.delay,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}

const SHINY_SPARKLES: ReadonlyArray<{
  x: string
  y: string
  size: number
  dur: string
  delay: string
  gold?: boolean
}> = [
  { x: '20%', y: '14%', size: 26, dur: '6.2s', delay: '0s' },
  { x: '70%', y: '11%', size: 20, dur: '5.4s', delay: '0.8s', gold: true },
  { x: '48%', y: '20%', size: 30, dur: '7.2s', delay: '1.7s' },
  { x: '32%', y: '34%', size: 18, dur: '5.8s', delay: '2.3s', gold: true },
  { x: '76%', y: '32%', size: 24, dur: '6.6s', delay: '0.5s' },
  { x: '14%', y: '48%', size: 20, dur: '5s', delay: '2.9s' },
  { x: '56%', y: '44%', size: 28, dur: '7.6s', delay: '1.3s', gold: true },
  { x: '82%', y: '54%', size: 18, dur: '5.6s', delay: '3.4s' },
  { x: '38%', y: '58%', size: 22, dur: '6.4s', delay: '1.9s' },
  { x: '64%', y: '66%', size: 20, dur: '5.2s', delay: '2.7s', gold: true },
  { x: '24%', y: '70%', size: 16, dur: '6.8s', delay: '3.8s' },
  { x: '50%', y: '28%', size: 16, dur: '4.8s', delay: '4.2s' },
]

function PreviewPhoto({
  slide,
  requiredTags,
  showFx,
}: {
  slide?: PreviewSlide | null
  requiredTags: TagId[]
  showFx: boolean
}) {
  const tags = slide ? specimenTags(slide.specimen) : []
  const name = slide ? SPECIES_BY_ID.get(slide.specimen.speciesId)?.name : undefined
  const purity = slide
    ? coverPurity(
        tags,
        requiredTags,
        isSilhouette(slide.specimen),
        slide.specimen.speciesId,
        slide.specimen.gender,
      )
    : null
  return (
    <div className={styles.slide}>
      <div
        className={styles.photo}
        data-purity={!showFx ? (purity ?? '') : undefined}
        data-shadow={showFx && tags.includes('shadow') ? 'true' : 'false'}
        data-purified={showFx && tags.includes('purified') ? 'true' : 'false'}
      >
        {slide?.imageUrl ? (
          <img src={slide.imageUrl} alt={name ?? 'Specimen'} draggable={false} />
        ) : null}
        {showFx && tags.includes('shiny') ? <ShinySparkles /> : null}
        {showFx && tags.includes('hundo') ? <span className={styles.hundo} /> : null}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { SPECIES_BY_ID } from '../data/species'
import type { SpecimenRow } from '../lib/db'
import { specimenTags, TAG_LABELS } from '../lib/tags'
import { TagChip } from './TagChip'
import styles from './CardPreview.module.css'

type Props = {
  specimen: SpecimenRow
  mediumUrl: string
  canSetCover: boolean
  onClose: () => void
  onSetCover: () => void
  onOpenGallery: () => void
}

export function CardPreview({
  specimen,
  mediumUrl,
  canSetCover,
  onClose,
  onSetCover,
  onOpenGallery,
}: Props) {
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  const tags = specimenTags(specimen)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onTouchStart(e: React.TouchEvent) {
    sheetRef.current?.setAttribute('data-start', String(e.touches[0].clientY))
  }

  function onTouchMove(e: React.TouchEvent) {
    const start = Number(sheetRef.current?.getAttribute('data-start') ?? 0)
    const dy = e.touches[0].clientY - start
    if (dy > 0) setDragY(dy)
  }

  function onTouchEnd() {
    if (dragY > 90) onClose()
    setDragY(0)
  }

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Specimen preview"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.photoWrap}>
          <div
            className={styles.photo}
            data-shadow={specimen.shadowStatus === 'shadow' ? 'true' : 'false'}
            data-purified={specimen.shadowStatus === 'purified' ? 'true' : 'false'}
          >
            <img src={mediumUrl} alt={species?.name ?? 'Specimen'} />
            {tags.includes('shiny') ? (
              <>
                <span className={styles.shine} />
                <span className={styles.sparkles} />
              </>
            ) : null}
            {tags.includes('hundo') ? <span className={styles.hundo} /> : null}
          </div>
        </div>
        <div className={styles.meta}>
          <h2>{species?.name ?? 'Unknown'}</h2>
          {specimen.form ? <p className={styles.form}>{specimen.form}</p> : null}
          <div className="chip-row">
            {tags.map((tag) => {
              const extra =
                tag === 'costume'
                  ? specimen.costume || TAG_LABELS.costume
                  : tag === 'background'
                    ? specimen.background || TAG_LABELS.background
                    : TAG_LABELS[tag]
              return <TagChip key={tag} tag={tag} selected label={extra} />
            })}
          </div>
        </div>
        <div className={styles.actions}>
          {canSetCover ? (
            <button type="button" className="btn btn-primary" onClick={onSetCover}>
              Set as cover
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onOpenGallery}>
            Species gallery
          </button>
        </div>
      </div>
    </div>
  )
}

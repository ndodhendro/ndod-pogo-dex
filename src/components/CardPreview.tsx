import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, lookForTag } from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { db, type SpecimenRow } from '../lib/db'
import { specimenTags, labelForTag } from '../lib/tags'
import { TagChip } from './TagChip'
import styles from './CardPreview.module.css'

type Props = {
  specimen: SpecimenRow
  mediumUrl: string
  canSetCover: boolean
  onClose: () => void
  onSetCover: () => void
  onOpenGallery: () => void
  onDelete: () => void | Promise<void>
}

export function CardPreview({
  specimen,
  mediumUrl,
  canSetCover,
  onClose,
  onSetCover,
  onOpenGallery,
  onDelete,
}: Props) {
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  const tags = specimenTags(specimen)
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setConfirmDelete(false)
    setDeleting(false)
  }, [specimen.id])

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

  async function confirmRemove() {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
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
                className="btn btn-primary"
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
            {canSetCover ? (
              <button type="button" className="btn btn-primary" onClick={onSetCover}>
                Set as cover
              </button>
            ) : null}
            <button type="button" className="btn" onClick={onOpenGallery}>
              Species gallery
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
              <span aria-hidden="true">🗑️</span>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

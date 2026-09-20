import { useEffect, useState } from 'react'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { sameLookFilenamesCopied } from '../lib/screenshotFileName'
import { useToast } from '../lib/toast'
import { BottomSheet } from './BottomSheet'
import { FileNameCopy } from './FileNameCopy'
import styles from './SameLookSheet.module.css'

type Shot = {
  imageId: string
  fileName?: string | null
}

type Props = {
  open: boolean
  nested?: boolean
  current?: Shot | null
  next?: Shot | null
  speciesId?: number
  nextTone?: string
  busy: boolean
  onClose: () => void
  onDiscard: () => void | Promise<void>
  onReplace: () => void | Promise<void>
}

export function SameLookSheet({
  open,
  nested = false,
  current,
  next,
  speciesId,
  nextTone,
  busy,
  onClose,
  onDiscard,
  onReplace,
}: Props) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState({ current: false, next: false })
  const speciesName = speciesId ? SPECIES_BY_ID.get(speciesId)?.name : undefined

  useEffect(() => {
    setCopied({ current: false, next: false })
  }, [current?.imageId, next?.imageId, open])

  function requireCopies() {
    if (sameLookFilenamesCopied(copied, current?.fileName, next?.fileName)) return true
    showToast('Copy a screenshot filename first', 'warning')
    return false
  }

  return (
    <BottomSheet
      open={open}
      title="Same look"
      nested={nested}
      showClose={false}
      onClose={() => {
        if (busy) return
        onClose()
      }}
    >
      <p className={`page-sub ${styles.copy}`}>
        {speciesName
          ? `${speciesName} with this look is already in your collection. Replace the current screenshot or discard the new one.`
          : 'This look is already in your collection. Replace the current screenshot or discard the new one.'}
      </p>
      {current && next ? (
        <div className={styles.compare}>
          <DuplicateShot
            imageId={current.imageId}
            fileName={current.fileName}
            label="Current"
            onCopied={() => setCopied((prev) => ({ ...prev, current: true }))}
          />
          <DuplicateShot
            imageId={next.imageId}
            fileName={next.fileName}
            label="New"
            tone={nextTone}
            onCopied={() => setCopied((prev) => ({ ...prev, next: true }))}
          />
        </div>
      ) : null}
      <div className="confirm-actions">
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={() => {
            if (!requireCopies()) return
            void onDiscard()
          }}
        >
          <span aria-hidden="true">🗑️</span>
          {busy ? 'Working…' : 'Discard'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            if (!requireCopies()) return
            void onReplace()
          }}
        >
          <span aria-hidden="true">🔁</span>
          {busy ? 'Working…' : 'Replace'}
        </button>
      </div>
    </BottomSheet>
  )
}

function DuplicateShot({
  imageId,
  fileName,
  label,
  tone,
  onCopied,
}: {
  imageId: string
  fileName?: string | null
  label: string
  tone?: string
  onCopied?: () => void
}) {
  const url = useImageUrl(imageId, 'medium')
  return (
    <figure className={styles.shot}>
      <figcaption className={styles.shotLabel} data-tone={tone}>
        {label}
      </figcaption>
      <div className={styles.shotFrame}>
        {url ? <img src={url} alt={label} /> : <span />}
      </div>
      <FileNameCopy
        fileName={fileName}
        size="sm"
        className={styles.shotFileName}
        onCopied={onCopied}
      />
    </figure>
  )
}

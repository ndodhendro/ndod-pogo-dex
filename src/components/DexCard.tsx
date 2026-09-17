import { useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { CoverPurity } from '../lib/covers'
import { formatDexSpeciesId } from '../lib/dexGrid'
import styles from './DexCard.module.css'

type Props = {
  name: string
  number: number
  extraCount?: number
  thumbUrl?: string | null
  purity?: CoverPurity | null
  filled?: boolean
  fill?: boolean
  grabbed?: boolean
  onClick?: () => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void
}

export function DexCard({
  name,
  number,
  extraCount = 0,
  thumbUrl,
  purity,
  filled,
  fill,
  grabbed,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const idLabel = formatDexSpeciesId(number, extraCount)

  return (
    <div
      className={styles.card}
      data-purity={purity ?? ''}
      data-empty={filled ? 'false' : 'true'}
      data-fill={fill ? 'true' : undefined}
      data-grabbed={grabbed ? 'true' : undefined}
      data-name-expanded={expanded ? 'true' : undefined}
    >
      <button
        type="button"
        className={styles.hit}
        aria-label={`${idLabel} ${name}`}
        aria-grabbed={grabbed ? 'true' : undefined}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        disabled={!onClick}
      >
        <div className={styles.frame}>
          {thumbUrl ? (
            <img src={thumbUrl} alt="" loading="lazy" draggable={false} width={128} height={278} />
          ) : null}
        </div>
      </button>
      <div className={styles.caption}>
        <span className={styles.num}>{idLabel}</span>
        <button
          type="button"
          className={styles.label}
          title={name}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {name}
        </button>
      </div>
    </div>
  )
}

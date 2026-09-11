import type { CoverPurity } from '../lib/covers'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import styles from './DexCard.module.css'

type Props = {
  name: string
  number: number
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
  return (
    <button
      type="button"
      className={styles.card}
      data-purity={purity ?? ''}
      data-empty={filled ? 'false' : 'true'}
      data-fill={fill ? 'true' : undefined}
      data-grabbed={grabbed ? 'true' : undefined}
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
      <div className={styles.caption}>
        <span className={styles.num}>#{String(number).padStart(4, '0')}</span>
        <span className={styles.label}>{name}</span>
      </div>
    </button>
  )
}

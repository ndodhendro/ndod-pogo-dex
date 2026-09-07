import type { CoverPurity } from '../lib/covers'
import styles from './DexCard.module.css'

type Props = {
  name: string
  number: number
  thumbUrl?: string | null
  purity?: CoverPurity | null
  filled?: boolean
  onClick?: () => void
}

export function DexCard({ name, number, thumbUrl, purity, filled, onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.card}
      data-purity={purity ?? ''}
      data-empty={filled ? 'false' : 'true'}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className={styles.frame}>
        {thumbUrl ? <img src={thumbUrl} alt="" loading="lazy" width={128} height={278} /> : null}
      </div>
      <div className={styles.caption}>
        <span className={styles.num}>#{String(number).padStart(4, '0')}</span>
        <span className={styles.label}>{name}</span>
      </div>
    </button>
  )
}

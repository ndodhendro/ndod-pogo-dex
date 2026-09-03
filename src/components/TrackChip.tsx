import type { UiTone } from '../data/navIcons'
import styles from './TrackChip.module.css'

type Props = {
  label: string
  icon?: string
  tone?: UiTone
  active?: boolean
  onClick?: () => void
}

export function TrackChip({ icon, label, tone, active, onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-tone={tone}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {label}
    </button>
  )
}

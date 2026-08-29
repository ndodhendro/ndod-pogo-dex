import styles from './TrackChip.module.css'

type Props = {
  label: string
  active?: boolean
  onClick?: () => void
}

export function TrackChip({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

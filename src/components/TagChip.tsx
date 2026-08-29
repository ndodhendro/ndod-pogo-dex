import { TAG_LABELS, type TagId } from '../lib/tags'
import styles from './TagChip.module.css'

type Props = {
  tag: TagId
  selected?: boolean
  label?: string
  onClick?: () => void
}

export function TagChip({ tag, selected, label, onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-tag={tag}
      data-on={selected ? 'true' : 'false'}
      onClick={onClick}
    >
      {label ?? TAG_LABELS[tag]}
    </button>
  )
}

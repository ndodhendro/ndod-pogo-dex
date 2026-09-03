import { TAG_ICONS } from '../data/navIcons'
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
      data-tone={tag}
      data-on={selected ? 'true' : 'false'}
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {TAG_ICONS[tag]}
      </span>
      {label ?? TAG_LABELS[tag]}
    </button>
  )
}

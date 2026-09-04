import { TAG_ICONS } from '../data/navIcons'
import { categoryChromeStyle, FALLBACK_EMOJI } from '../lib/categoryStyle'
import { isBuiltInTag, labelForTag, type TagId } from '../lib/tags'
import styles from './TagChip.module.css'

type Props = {
  tag: TagId
  selected?: boolean
  label?: string
  icon?: string
  labelColor?: string
  onClick?: () => void
}

export function TagChip({ tag, selected, label, icon, labelColor, onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-tag={tag}
      data-tone={isBuiltInTag(tag) ? tag : 'living'}
      data-on={selected ? 'true' : 'false'}
      style={labelColor ? categoryChromeStyle(labelColor) : undefined}
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon ?? (isBuiltInTag(tag) ? TAG_ICONS[tag] : FALLBACK_EMOJI)}
      </span>
      {label ?? labelForTag(tag)}
    </button>
  )
}

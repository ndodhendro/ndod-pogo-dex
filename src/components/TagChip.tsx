import { TAG_ICONS } from '../data/navIcons'
import { categoryChromeStyle, FALLBACK_EMOJI } from '../lib/categoryStyle'
import { isBuiltInTag, isFormTag, labelForTag, type TagId } from '../lib/tags'
import styles from './TagChip.module.css'

type Props = {
  tag: TagId
  selected?: boolean
  locked?: boolean
  label?: string
  icon?: string
  labelColor?: string
  onClick?: () => void
}

function chipTone(tag: TagId) {
  if (tag === 'silhouette') return 'nundo'
  if (isBuiltInTag(tag) || isFormTag(tag)) return tag
  return 'living'
}

export function TagChip({ tag, selected, locked, label, icon, labelColor, onClick }: Props) {
  const on = Boolean(selected || locked)
  return (
    <button
      type="button"
      className={styles.chip}
      data-tag={tag}
      data-tone={chipTone(tag)}
      data-on={on ? 'true' : 'false'}
      data-locked={locked ? 'true' : undefined}
      aria-pressed={onClick || locked ? on : undefined}
      aria-disabled={locked ? true : undefined}
      style={labelColor ? categoryChromeStyle(labelColor) : undefined}
      onClick={locked ? undefined : onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon ?? (isBuiltInTag(tag) ? TAG_ICONS[tag] : FALLBACK_EMOJI)}
      </span>
      {label ?? labelForTag(tag)}
    </button>
  )
}

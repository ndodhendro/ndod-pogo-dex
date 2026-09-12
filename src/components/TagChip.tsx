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
  size?: 'md' | 'sm'
  fill?: boolean
  expanded?: boolean
  onClick?: () => void
}

function chipTone(tag: TagId) {
  if (tag === 'silhouette') return 'nundo'
  if (isBuiltInTag(tag) || isFormTag(tag)) return tag
  return 'living'
}

export function TagChip({
  tag,
  selected,
  locked,
  label,
  icon,
  labelColor,
  size = 'md',
  fill = false,
  expanded = false,
  onClick,
}: Props) {
  const on = Boolean(selected || locked)
  const tone = chipTone(tag)
  const colorStyle = labelColor ? categoryChromeStyle(labelColor) : undefined
  const text = label ?? labelForTag(tag)
  const body = (
    <>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? (isBuiltInTag(tag) ? TAG_ICONS[tag] : FALLBACK_EMOJI)}
      </span>
      <span className={styles.text}>{text}</span>
    </>
  )
  const fillProps = fill
    ? {
        'data-fill': 'true' as const,
        'data-expanded': expanded ? ('true' as const) : 'false',
        title: text,
      }
    : undefined

  if (!onClick) {
    return (
      <span
        className={styles.chip}
        data-tag={tag}
        data-tone={tone}
        data-on={on ? 'true' : 'false'}
        data-size={size}
        style={colorStyle}
        {...fillProps}
      >
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={styles.chip}
      data-tag={tag}
      data-tone={tone}
      data-on={on ? 'true' : 'false'}
      data-locked={locked ? 'true' : undefined}
      data-size={size}
      aria-pressed={locked ? on : on}
      aria-disabled={locked ? true : undefined}
      aria-expanded={fill ? expanded : undefined}
      style={colorStyle}
      onClick={locked ? undefined : onClick}
      {...fillProps}
    >
      {body}
    </button>
  )
}

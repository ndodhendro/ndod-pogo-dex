import type { ReactNode } from 'react'
import { SEEN_ICON, type UiTone } from '../data/navIcons'
import { categoryChromeStyle } from '../lib/categoryStyle'
import {
  DEX_GRID_FILTER_KINDS,
  DEX_PROGRESS_KINDS,
  formatDexCompletionPercent,
  stackDexProgressLayers,
  toggleDexProgressFilter,
  type DexProgressKind,
} from '../lib/dexGrid'
import styles from './DexProgress.module.css'

const KIND_META: Record<DexProgressKind, { icon: string; label: string }> = {
  uncaught: { icon: '❓', label: 'Uncaught' },
  seen: { icon: SEEN_ICON, label: 'Seen' },
  caught: { icon: '🎯', label: 'Caught' },
  pure: { icon: '🟢', label: 'Pure' },
}

type Props = {
  seen: number
  caught: number
  pure: number
  total: number
  ariaLabel: string
  tone?: UiTone
  labelColor?: string
  heading?: ReactNode
  className?: string
  announce?: boolean
  compact?: boolean
  embedded?: boolean
  selectedKind?: DexProgressKind | null
  onSelectKind?: (kind: DexProgressKind | null) => void
  /** Stats to show. Defaults to the grid filters when selectable, otherwise Seen, Caught, and Pure. */
  kinds?: readonly DexProgressKind[]
  /** Which shown stats are filter buttons. Defaults to every shown stat when `onSelectKind` is set. */
  selectableKinds?: readonly DexProgressKind[]
  selectableName?: (kind: DexProgressKind) => string
  filtersLabel?: string
}

export function DexProgress({
  seen,
  caught,
  pure,
  total,
  ariaLabel,
  tone = 'dex',
  labelColor,
  heading,
  className,
  announce = true,
  compact = false,
  embedded = false,
  selectedKind = null,
  onSelectKind,
  kinds: kindsProp,
  selectableKinds,
  selectableName,
  filtersLabel,
}: Props) {
  const counts = { uncaught: Math.max(0, total - caught), seen, caught, pure }
  const layers = stackDexProgressLayers({ seen, caught, pure }, total)
  const selectable = Boolean(onSelectKind)
  const kinds = kindsProp ?? (selectable ? DEX_GRID_FILTER_KINDS : DEX_PROGRESS_KINDS)
  const kindSelects = (kind: DexProgressKind) =>
    selectable && (!selectableKinds || selectableKinds.includes(kind))
  const valueText = kinds.map((kind) => {
    const meta = KIND_META[kind]
    return `${meta.label} ${counts[kind]}/${total} (${formatDexCompletionPercent(counts[kind], total)})`
  }).join('. ')
  const highest = layers[0]
  return (
    <div
      className={[styles.progress, className].filter(Boolean).join(' ')}
      data-tone={embedded ? undefined : tone}
      data-compact={compact || embedded ? 'true' : undefined}
      data-embedded={embedded ? 'true' : undefined}
      style={embedded ? undefined : labelColor ? categoryChromeStyle(labelColor) : undefined}
    >
      {heading ? <span className={styles.heading}>{heading}</span> : null}
      <div
        className={styles.kinds}
        data-count={kinds.length}
        role={selectable ? 'group' : undefined}
        aria-label={selectable ? (filtersLabel ?? 'Filter grid') : undefined}
      >
        {kinds.map((kind) => {
          const meta = KIND_META[kind]
          const current = counts[kind]
          const selected = selectedKind === kind
          const interactive = kindSelects(kind)
          const body = (
            <>
              <span className={styles.kindIcon} aria-hidden="true">
                {meta.icon}
              </span>
              <span className={styles.kindMeta}>
                <span className={styles.kindName}>{meta.label}</span>
                <span className={styles.kindCount}>
                  <span className={styles.kindFraction}>
                    {current}/{total}
                  </span>
                  <span className={styles.kindPct}>
                    ({formatDexCompletionPercent(current, total)})
                  </span>
                </span>
              </span>
            </>
          )
          if (!interactive) {
            return (
              <div key={kind} className={styles.kind} data-kind={kind}>
                {body}
              </div>
            )
          }
          return (
            <button
              key={kind}
              type="button"
              className={styles.kind}
              data-kind={kind}
              data-selectable="true"
              data-on={selected ? 'true' : undefined}
              aria-pressed={selected}
              aria-label={selectableName?.(kind)}
              onClick={() => onSelectKind?.(toggleDexProgressFilter(selectedKind, kind))}
            >
              {body}
            </button>
          )
        })}
      </div>
      <div
        className={styles.track}
        role={announce ? 'progressbar' : undefined}
        aria-hidden={announce ? undefined : true}
        aria-label={announce ? ariaLabel : undefined}
        aria-valuemin={announce ? 0 : undefined}
        aria-valuemax={announce ? 100 : undefined}
        aria-valuenow={announce ? Number(highest.percent.toFixed(2)) : undefined}
        aria-valuetext={announce ? valueText : undefined}
      >
        {layers.map((layer, index) =>
          layer.percent > 0 ? (
            <span
              key={layer.kind}
              className={styles.fill}
              data-kind={layer.kind}
              style={{ width: `${layer.percent}%`, zIndex: index + 1 }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}

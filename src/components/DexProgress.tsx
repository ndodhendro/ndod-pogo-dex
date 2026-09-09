import type { ReactNode } from 'react'
import type { UiTone } from '../data/navIcons'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { dexCompletionPercent, formatDexCompletionPercent } from '../lib/dexGrid'
import styles from './DexProgress.module.css'

type Props = {
  filled: number
  total: number
  ariaLabel: string
  tone?: UiTone
  labelColor?: string
  heading?: ReactNode
  className?: string
  announce?: boolean
  compact?: boolean
}

export function DexProgress({
  filled,
  total,
  ariaLabel,
  tone = 'dex',
  labelColor,
  heading,
  className,
  announce = true,
  compact = false,
}: Props) {
  const percent = dexCompletionPercent(filled, total)
  const completionLabel = formatDexCompletionPercent(filled, total)
  return (
    <div
      className={[styles.progress, className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-compact={compact ? 'true' : undefined}
      style={labelColor ? categoryChromeStyle(labelColor) : undefined}
    >
      <div className={styles.meta}>
        {heading ? <span className={styles.heading}>{heading}</span> : null}
        <span className={styles.stats}>
          <span>
            {filled} / {total}
          </span>
          <span className={styles.percent}>{completionLabel}</span>
        </span>
      </div>
      <div
        className={styles.track}
        role={announce ? 'progressbar' : undefined}
        aria-hidden={announce ? undefined : true}
        aria-label={announce ? ariaLabel : undefined}
        aria-valuemin={announce ? 0 : undefined}
        aria-valuemax={announce ? 100 : undefined}
        aria-valuenow={announce ? Number(percent.toFixed(2)) : undefined}
        aria-valuetext={announce ? `${filled} of ${total}, ${completionLabel}` : undefined}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

import { type MouseEvent } from 'react'
import { copyText } from '../lib/clipboard'
import { screenshotFileName } from '../lib/screenshotFileName'
import { useToast } from '../lib/toast'
import styles from './FileNameCopy.module.css'

type Props = {
  fileName?: string | null
  size?: 'sm' | 'md' | 'compact'
  className?: string
}

export function FileNameCopy({ fileName, size = 'sm', className }: Props) {
  const { showToast } = useToast()
  const name = screenshotFileName(fileName)
  if (!name) return null
  const label = name

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()
    try {
      await copyText(label)
      showToast('Filename copied', 'success')
    } catch {
      showToast('Could not copy filename')
    }
  }

  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')} data-size={size}>
      <span className={styles.name} title={label}>
        {label}
      </span>
      <button
        type="button"
        className={`btn btn-ghost ${styles.copy}`}
        aria-label={`Copy ${label}`}
        onClick={(event) => void copy(event)}
      >
        <span aria-hidden="true">📋</span>
        Copy
      </button>
    </div>
  )
}

import { useState } from 'react'
import styles from './PinPad.module.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const
const PIN_LEN = 6

type Props = {
  title: string
  subtitle?: string
  error?: string | null
  onComplete: (pin: string) => void
}

export function PinPad({ title, subtitle, error, onComplete }: Props) {
  const [digits, setDigits] = useState('')

  function press(key: string) {
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    if (!key || digits.length >= PIN_LEN) return
    const next = digits + key
    setDigits(next)
    if (next.length === PIN_LEN) {
      onComplete(next)
      setDigits('')
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.sub}>{subtitle}</p> : null}
        <div className={styles.dots} aria-hidden="true">
          {Array.from({ length: PIN_LEN }, (_, i) => (
            <span key={i} className={styles.dot} data-on={i < digits.length ? 'true' : 'false'} />
          ))}
        </div>
        <p className={styles.error}>{error ?? ''}</p>
        <div className={styles.grid}>
          {KEYS.map((key, i) =>
            key ? (
              <button key={key + i} type="button" className={styles.key} onClick={() => press(key)}>
                {key === 'del' ? '⌫' : key}
              </button>
            ) : (
              <span key={`empty-${i}`} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

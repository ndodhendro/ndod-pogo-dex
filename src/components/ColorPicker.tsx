import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type Ref } from 'react'
import { hexToHsv, hsvToHex, normalizeHexColor, type HsvColor } from '../lib/categoryStyle'
import styles from './ColorPicker.module.css'

type Props = {
  value: string
  onChange: (hex: string) => void
  'aria-label'?: string
  swatchRef?: Ref<HTMLButtonElement>
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

export function ColorPicker({
  value,
  onChange,
  'aria-label': ariaLabel,
  swatchRef,
}: Props) {
  const padRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(value))

  useEffect(() => {
    const hex = normalizeHexColor(value)
    if (!hex) return
    setHsv((current) => (hsvToHex(current) === hex ? current : hexToHsv(hex)))
  }, [value])

  function commit(next: HsvColor) {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  function svFromPointer(clientX: number, clientY: number) {
    const pad = padRef.current
    if (!pad) return hsv
    const rect = pad.getBoundingClientRect()
    return {
      ...hsv,
      s: clamp01((clientX - rect.left) / rect.width),
      v: 1 - clamp01((clientY - rect.top) / rect.height),
    }
  }

  function onPadPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    commit(svFromPointer(event.clientX, event.clientY))
  }

  function onPadPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.preventDefault()
    commit(svFromPointer(event.clientX, event.clientY))
  }

  const label = ariaLabel ?? 'Font color'
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div className={styles.wrap} style={{ '--hue': hueColor } as CSSProperties}>
      <button
        ref={swatchRef}
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          className={styles.picker}
          role="dialog"
          aria-label={`${label} picker`}
        >
          <div
            ref={padRef}
            className={styles.pad}
            role="slider"
            aria-label="Saturation and brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            tabIndex={0}
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.08 : 0.02
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                commit({ ...hsv, s: clamp01(hsv.s - step) })
              } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                commit({ ...hsv, s: clamp01(hsv.s + step) })
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                commit({ ...hsv, v: clamp01(hsv.v - step) })
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                commit({ ...hsv, v: clamp01(hsv.v + step) })
              }
            }}
          >
            <span
              className={styles.padThumb}
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <label className={styles.hueField}>
            <span className={styles.hueLabel}>Hue</span>
            <input
              className={styles.hue}
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(hsv.h)}
              aria-valuetext={`${Math.round(hsv.h)} degrees`}
              onChange={(event) => commit({ ...hsv, h: Number(event.target.value) })}
            />
          </label>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      ) : null}
    </div>
  )
}



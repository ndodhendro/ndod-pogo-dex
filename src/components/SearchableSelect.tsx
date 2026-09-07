import { useEffect, useMemo, useRef, useState } from 'react'
import type { UiTone } from '../data/navIcons'
import { filterByLabel } from '../lib/filterByLabel'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { SearchField } from './SearchField'
import styles from './SearchableSelect.module.css'

export type SearchableSelectOption = {
  id: string
  icon: string
  label: string
  tone?: UiTone
  labelColor?: string
}

type Props = {
  value: string
  options: SearchableSelectOption[]
  onChange: (id: string) => void
  className?: string
  searchPlaceholder?: string
  ariaLabel?: string
}

export function SearchableSelect({
  value,
  options,
  onChange,
  className,
  searchPlaceholder = 'Search',
  ariaLabel,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.id === value) ?? options[0]
  const matches = useMemo(() => filterByLabel(options, query), [options, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!selected) return null

  return (
    <div ref={rootRef} className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.trigger}
        data-tone={selected.tone}
        data-open={open ? 'true' : 'false'}
        style={selected.labelColor ? categoryChromeStyle(selected.labelColor) : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${selected.label}` : undefined}
        onClick={() => setOpen((next) => !next)}
      >
        <span className={styles.icon} aria-hidden="true">
          {selected.icon}
        </span>
        <span className={styles.label}>{selected.label}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className={styles.menu}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
            autoFocus
            aria-label={searchPlaceholder}
          />
          <div className={styles.list} role="listbox" aria-label={ariaLabel ?? 'Options'}>
            {matches.length === 0 ? (
              <p className={styles.empty}>No matches</p>
            ) : (
              matches.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  className={styles.option}
                  data-tone={option.tone}
                  data-on={option.id === selected.id ? 'true' : 'false'}
                  style={option.labelColor ? categoryChromeStyle(option.labelColor) : undefined}
                  aria-selected={option.id === selected.id}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {option.icon}
                  </span>
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

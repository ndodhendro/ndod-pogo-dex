import styles from './SearchField.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  'aria-label'?: string
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
  autoFocus,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <label className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => onChange('')}>
          Clear
        </button>
      ) : null}
    </label>
  )
}

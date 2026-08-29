import styles from './SearchField.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchField({ value, onChange, placeholder = 'Search' }: Props) {
  return (
    <label className={styles.wrap}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => onChange('')}>
          Clear
        </button>
      ) : null}
    </label>
  )
}

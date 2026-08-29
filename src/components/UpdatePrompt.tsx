import { usePwaUpdate } from '../hooks/usePwaUpdate'
import styles from './UpdatePrompt.module.css'

export function UpdatePrompt() {
  const { needRefresh, reload, dismiss } = usePwaUpdate()
  if (!needRefresh) return null

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className={styles.card}>
        <h2 id="update-title">Update available</h2>
        <p>A new version of Ndod Pogo Dex is ready. Reload to use it.</p>
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={dismiss}>
            Later
          </button>
          <button type="button" className="btn btn-primary" onClick={reload}>
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}

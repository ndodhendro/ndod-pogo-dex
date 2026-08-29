import { useToast } from '../lib/toast'
import styles from './Toast.module.css'

export function Toast() {
  const { toasts, dismissToast } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className={styles.region} role="status">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={styles.toast}
          data-tone={toast.tone}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.text}
        </button>
      ))}
    </div>
  )
}

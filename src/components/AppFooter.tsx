import { APP_CONFIG } from '../config'
import styles from './AppFooter.module.css'

export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <span className={styles.credit}>{APP_CONFIG.credit}</span>
      <span className={styles.version}>v{APP_CONFIG.version}</span>
    </footer>
  )
}

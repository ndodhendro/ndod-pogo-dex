import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { APP_CONFIG } from '../config'
import { TAB_ICONS } from '../data/navIcons'
import { db } from '../lib/db'
import styles from './AppShell.module.css'

export function AppShell() {
  const inboxCount = useLiveQuery(() => db.inbox.count(), []) ?? 0

  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>v{APP_CONFIG.version}</span>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <span>{APP_CONFIG.credit}</span>
      </footer>
      <nav className={styles.nav}>
        <NavLink
          to="/inbox"
          data-tone="inbox"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <span className={styles.icon} aria-hidden="true">
            {TAB_ICONS.inbox}
          </span>
          <span className={styles.label}>
            Inbox
            {inboxCount > 0 ? <span className={styles.badge}>{inboxCount}</span> : null}
          </span>
        </NavLink>
        <NavLink
          to="/dex"
          data-tone="dex"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <span className={styles.icon} aria-hidden="true">
            {TAB_ICONS.dex}
          </span>
          <span className={styles.label}>Dex</span>
        </NavLink>
        <NavLink
          to="/settings"
          data-tone="settings"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <span className={styles.icon} aria-hidden="true">
            {TAB_ICONS.settings}
          </span>
          <span className={styles.label}>Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}

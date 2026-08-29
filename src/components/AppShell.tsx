import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { APP_CONFIG } from '../config'
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
        <NavLink to="/inbox" className={({ isActive }) => (isActive ? styles.active : undefined)}>
          Inbox
          {inboxCount > 0 ? <span className={styles.badge}>{inboxCount}</span> : null}
        </NavLink>
        <NavLink
          to="/dex"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          Dex
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          Settings
        </NavLink>
      </nav>
    </div>
  )
}

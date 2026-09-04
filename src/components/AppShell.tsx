import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { APP_CONFIG } from '../config'
import { TAB_ICONS, TAB_LOGOS } from '../data/navIcons'
import { db } from '../lib/db'
import styles from './AppShell.module.css'

export function AppShell() {
  const inboxCount = useLiveQuery(() => db.inbox.count(), []) ?? 0

  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className={styles.nav}>
        <NavLink
          to="/transfer"
          data-tone="inbox"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <span className={styles.icon} aria-hidden="true">
            {TAB_ICONS.inbox}
          </span>
          <span className={styles.label}>
            Transfer
            {inboxCount > 0 ? <span className={styles.badge}>{inboxCount}</span> : null}
          </span>
        </NavLink>
        <NavLink
          to="/dex"
          data-tone="dex"
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <span className={styles.icon} aria-hidden="true">
            <img
              className={styles.logo}
              src={`${import.meta.env.BASE_URL}${TAB_LOGOS.dex}`}
              alt=""
              draggable={false}
              width={24}
              height={24}
            />
          </span>
          <span className={styles.label}>Pokédex</span>
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
      <footer className={styles.footer}>
        <span className={styles.version}>v{APP_CONFIG.version}</span>
        <span className={styles.credit}>{APP_CONFIG.credit}</span>
      </footer>
    </div>
  )
}

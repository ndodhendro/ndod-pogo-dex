import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DexProgress } from '../components/DexProgress'
import { colorForCategory, iconForCategory, TAB_LOGOS, toneForCategory } from '../data/navIcons'
import { countFilledSlots } from '../lib/roster'
import { db, ensureSeedCategories } from '../lib/db'
import styles from './DexOverview.module.css'

export function DexOverviewPage() {
  const categories =
    useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const specimens = useLiveQuery(() => db.specimens.toArray(), []) ?? []
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? []
  const roster = useLiveQuery(() => db.tagRoster.toArray(), []) ?? []

  useEffect(() => {
    void ensureSeedCategories()
  }, [])

  const tracks = useMemo(
    () =>
      categories.map((category) => ({
        category,
        ...countFilledSlots(specimens, category.requiredTags, catalogs, roster),
      })),
    [categories, specimens, catalogs, roster],
  )

  return (
    <section>
      <h1 className={`page-title ${styles.title}`} data-tone="dex">
        <span className={styles.titleIcon} aria-hidden="true">
          <img
            className={styles.logo}
            src={`${import.meta.env.BASE_URL}${TAB_LOGOS.dex}`}
            alt=""
            width={24}
            height={24}
            draggable={false}
          />
        </span>
        Pokédex
      </h1>
      {tracks.length === 0 ? (
        <p className="empty-state">No tracks yet. Add a category in Settings.</p>
      ) : (
        <div className={`group ${styles.list}`}>
          {tracks.map(({ category, seen, caught, pure, total }) => (
            <Link
              key={category.id}
              className={styles.row}
              to={`/dex/${category.id}`}
              data-tone={toneForCategory(category)}
            >
              <DexProgress
                className={styles.rowProgress}
                seen={seen}
                caught={caught}
                pure={pure}
                total={total}
                ariaLabel={`${category.name} completion`}
                tone={toneForCategory(category)}
                labelColor={colorForCategory(category)}
                announce={false}
                heading={
                  <>
                    <span aria-hidden="true">{iconForCategory(category)}</span>
                    <span>{category.name}</span>
                  </>
                }
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { TagChip } from '../components/TagChip'
import { addCategory, deleteCategory } from '../lib/collection'
import { lockApp } from '../lib/auth'
import { db } from '../lib/db'
import { useToast } from '../lib/toast'
import { TAG_IDS, TAG_LABELS, type TagId } from '../lib/tags'
import styles from './Settings.module.css'

export function SettingsPage() {
  const { showToast } = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<TagId[]>([])

  async function create() {
    try {
      await addCategory(name, picked)
      setOpen(false)
      setName('')
      setPicked([])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add category')
    }
  }

  return (
    <section className={styles.stack}>
      <h1 className="page-title">Settings</h1>
      <div className={styles.card}>
        <h2>Categories</h2>
        <p className="page-sub">
          A category is a name plus required tags. Combos are categories, not new tags.
        </p>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.5rem 0',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div>
              <strong>{cat.name}</strong>
              <p className="page-sub" style={{ margin: 0 }}>
                {cat.requiredTags.length
                  ? cat.requiredTags.map((t) => TAG_LABELS[t]).join(', ')
                  : 'No required tags (Living)'}
              </p>
            </div>
            {cat.seed ? null : (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void deleteCategory(cat.id).catch((err) =>
                    showToast(err instanceof Error ? err.message : 'Could not delete'),
                  )
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Add category
        </button>
      </div>
      <div className={styles.card}>
        <h2>Lock</h2>
        <p className="page-sub">The app locks after 5 minutes idle. PIN is not stored in env.</p>
        <button type="button" className="btn" onClick={() => lockApp()}>
          Lock now
        </button>
      </div>
      <BottomSheet open={open} title="New category" onClose={() => setOpen(false)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shadow Hundo" />
        </label>
        <div className="field">
          <span>Required tags</span>
          <div className="chip-row">
            {TAG_IDS.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={picked.includes(tag)}
                onClick={() =>
                  setPicked((list) =>
                    list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag],
                  )
                }
              />
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void create()}>
          Save category
        </button>
      </BottomSheet>
    </section>
  )
}

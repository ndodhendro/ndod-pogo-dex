import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { TagChip } from '../components/TagChip'
import { RestoreGalleryButton } from '../components/RestoreGalleryButton'
import { addCategory, deleteCategory } from '../lib/collection'
import { getSession, signOut, userEmail } from '../lib/auth'
import { db } from '../lib/db'
import { backupAllMetadata } from '../lib/sync'
import { useToast } from '../lib/toast'
import { TAG_IDS, TAG_LABELS, type TagId } from '../lib/tags'
import styles from './Settings.module.css'

export function SettingsPage() {
  const { showToast } = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<TagId[]>([])
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    void getSession().then((session) => setEmail(userEmail(session?.user)))
  }, [])

  async function create() {
    try {
      const cloudError = await addCategory(name, picked)
      setOpen(false)
      setName('')
      setPicked([])
      if (cloudError) showToast(cloudError, 'warning')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add category')
    }
  }

  async function backupNow() {
    const message = await backupAllMetadata()
    if (message) showToast(message, 'warning')
  }

  async function onSignOut() {
    try {
      await signOut()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sign out')
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
                  void deleteCategory(cat.id).then((cloudError) => {
                    if (cloudError) showToast(cloudError, 'warning')
                  }).catch((err) =>
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
        <h2>Account</h2>
        <p className="page-sub">
          {email ? `Signed in as ${email}.` : 'Signed in with Google.'} The same account restores
          tags on another device.
        </p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void backupNow()}>
            Backup tags now
          </button>
          <button type="button" className="btn" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </div>
      <div className={styles.card}>
        <h2>Restore</h2>
        <p className="page-sub">
          A phone restart keeps the Dex. After clearing site data, sign in with the same Google
          account, then pick the original screenshots from the gallery album. Matching files get
          their tags back. Unmatched files go to Inbox.
        </p>
        <RestoreGalleryButton />
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

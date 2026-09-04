import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { ColorPicker } from '../components/ColorPicker'
import { TrackChip } from '../components/TrackChip'
import { RestoreGalleryButton } from '../components/RestoreGalleryButton'
import { colorForCategory, iconForCategory, lookForTag, requiredTagChoices, toneForCategory } from '../data/navIcons'
import { insertCategoryIdAt, moveCategoryId, sameCategoryOrder } from '../lib/categoryOrder'
import { categoryChromeStyle, DEFAULT_LABEL_COLOR, FALLBACK_EMOJI, pickEmojiInput } from '../lib/categoryStyle'
import { clampSwipe, SWIPE_LOCK, SWIPE_OPEN_RATIO, SWIPE_WIDTH } from '../lib/swipeReveal'
import { addCategory, deleteCategory, reorderCategories, updateCategory } from '../lib/collection'
import { getSession, signOut, userEmail } from '../lib/auth'
import { db, ensureSeedCategories, type CategoryRow } from '../lib/db'
import { backupAllMetadata } from '../lib/sync'
import { backupProgressLabel, type BackupProgress } from '../lib/syncBackup'
import { toastAfterWrite, useToast } from '../lib/toast'
import { categorySaveWarning, toggleRequiredTags, type TagId } from '../lib/tags'
import styles from './Settings.module.css'

export function SettingsPage() {
  const { showToast } = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<TagId[]>([])
  const [emoji, setEmoji] = useState(FALLBACK_EMOJI)
  const [labelColor, setLabelColor] = useState(DEFAULT_LABEL_COLOR)
  const [lookLocked, setLookLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLButtonElement>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null)

  useEffect(() => {
    void ensureSeedCategories()
  }, [])

  useEffect(() => {
    void getSession().then((session) => setEmail(userEmail(session?.user)))
  }, [])

  function closeSheet() {
    setOpen(false)
    setEditing(null)
    setName('')
    setPicked([])
    setEmoji(FALLBACK_EMOJI)
    setLabelColor(DEFAULT_LABEL_COLOR)
    setLookLocked(false)
  }

  function openNew() {
    setEditing(null)
    setName('')
    setPicked([])
    setEmoji(FALLBACK_EMOJI)
    setLabelColor(DEFAULT_LABEL_COLOR)
    setLookLocked(false)
    setOpen(true)
  }

  function openEdit(cat: CategoryRow) {
    setEditing(cat)
    setName(cat.name)
    setPicked([...cat.requiredTags])
    setEmoji(iconForCategory(cat))
    setLabelColor(colorForCategory(cat))
    setLookLocked(true)
    setOpen(true)
  }

  function setPickedTags(next: TagId[]) {
    setPicked(next)
    if (lookLocked) return
    const first = next[0]
    setEmoji(first ? lookForTag(first, categories).emoji : FALLBACK_EMOJI)
  }

  async function save() {
    if (busyRef.current) return
    const warning = categorySaveWarning(name)
    if (warning) {
      showToast(warning, 'warning')
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      const look = { emoji, labelColor }
      const cloudError = editing
        ? await updateCategory(editing.id, name, picked, look)
        : await addCategory(name, picked, look)
      closeSheet()
      toastAfterWrite(showToast, editing ? 'Category saved' : 'Category added', cloudError)
    } catch (err) {
      showToast(err instanceof Error ? err.message : editing ? 'Could not save category' : 'Could not add category')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function backupNow() {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupProgress(null)
    try {
      const message = await backupAllMetadata(setBackupProgress)
      if (message) showToast(message, 'warning')
      else showToast('Tags backed up', 'success')
    } finally {
      setBackupBusy(false)
      setBackupProgress(null)
    }
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
      <h1 className="page-title" data-tone="settings">
        Settings
      </h1>
      <div className="group">
        <h2>Categories</h2>
        
        <button type="button" className={`btn btn-primary ${styles.addCategory}`} onClick={openNew}>
          Add category
        </button>
        <CategoryOrderList
          categories={categories}
          onEdit={openEdit}
          onCloudWarning={(message) => showToast(message, 'warning')}
          onSaved={(message) => showToast(message, 'success')}
          onError={(message) => showToast(message)}
        />
      </div>
      <div className="group">
        <h2>Account</h2>
        <p className="page-sub">
          {email ? `Signed in as ${email}.` : 'Signed in with Google.'}
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn"
            disabled={backupBusy}
            onClick={() => void backupNow()}
          >
            {backupBusy ? 'Backing up…' : 'Backup tags now'}
          </button>
          <button type="button" className="btn" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
        {backupProgress ? <p className="page-sub">{backupProgressLabel(backupProgress)}</p> : null}
      </div>
      <div className="group">
        <h2>Restore</h2>
        <RestoreGalleryButton />
      </div>
      <BottomSheet
        open={open}
        title={editing ? 'Edit category' : 'New category'}
        onClose={closeSheet}
      >
        <form
          className={styles.categoryForm}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="field">
            <span>Name</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shadow Hundo"
              enterKeyHint="next"
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                emojiRef.current?.focus()
              }}
            />
          </label>
          <div className={styles.lookRow}>
            <label className="field">
              <span>Emoji</span>
              <input
                ref={emojiRef}
                className={styles.emojiInput}
                value={emoji}
                onChange={(e) => {
                  setLookLocked(true)
                  setEmoji(pickEmojiInput(emoji, e.target.value))
                }}
                placeholder={FALLBACK_EMOJI}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-label="Category emoji"
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  colorRef.current?.focus()
                }}
              />
            </label>
            <div className="field">
              <span>Font color</span>
              <ColorPicker value={labelColor} onChange={setLabelColor} swatchRef={colorRef} />
            </div>
          </div>
          <div className="field">
            <span>Preview</span>
            <div className={styles.lookPreview}>
              <TrackChip
                icon={emoji || FALLBACK_EMOJI}
                label={name.trim() || 'Category'}
                tone={toneForCategory({ name, requiredTags: picked })}
                labelColor={labelColor}
                active
              />
            </div>
          </div>
          <div className="field">
            <span>Required tags</span>
            <div className="chip-row">
              {requiredTagChoices(categories).map((choice) => (
                <TrackChip
                  key={choice.key}
                  icon={choice.icon}
                  label={choice.label}
                  tone={choice.tone}
                  labelColor={choice.labelColor}
                  active={choice.tags.every((tag) => picked.includes(tag))}
                  onClick={() => setPickedTags(toggleRequiredTags(picked, choice.tags))}
                />
              ))}
            </div>
          </div>
          <button type="submit" className={`btn btn-primary ${styles.sheetSave}`} disabled={busy}>
            {busy ? 'Saving…' : 'Save category'}
          </button>
        </form>
      </BottomSheet>
    </section>
  )
}

const HOLD_MS = 1000

function CategoryOrderList({
  categories,
  onEdit,
  onCloudWarning,
  onSaved,
  onError,
}: {
  categories: CategoryRow[]
  onEdit: (cat: CategoryRow) => void
  onCloudWarning: (message: string) => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const liveIdsRef = useRef<string[]>([])
  const orderedIdsRef = useRef<string[]>([])
  const draftRef = useRef<string[] | null>(null)
  const savingRef = useRef(false)
  const pressRef = useRef<{
    id: string
    pointerId: number
    lastY: number
    timer: number
  } | null>(null)
  const dragRef = useRef<{
    id: string
    startY: number
    originIndex: number
    originIds: string[]
    heights: number[]
    targetIndex: number
  } | null>(null)
  const [draft, setDraft] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [deltaY, setDeltaY] = useState(0)
  const [targetIndex, setTargetIndex] = useState(0)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeId, setSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const swipeRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    startOffset: number
    width: number
    axis: 'x' | 'y' | null
  } | null>(null)
  const swipeOffsetRef = useRef(0)
  const ignoreClickRef = useRef(false)

  const liveIds = categories.map((row) => row.id)
  const orderedIds = draft ?? liveIds
  liveIdsRef.current = liveIds
  orderedIdsRef.current = orderedIds
  const byId = new Map(categories.map((row) => [row.id, row]))
  const displayIds = dragId && dragRef.current ? dragRef.current.originIds : orderedIds
  const rows = displayIds.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })

  useEffect(() => {
    if (!draft || dragRef.current || savingRef.current) return
    if (sameCategoryOrder(draft, liveIds)) {
      setDraft(null)
      draftRef.current = null
    }
  }, [draft, liveIds])

  useEffect(
    () => () => {
      const press = pressRef.current
      if (press) window.clearTimeout(press.timer)
    },
    [],
  )

  useEffect(() => {
    function onTouchMove(event: TouchEvent) {
      if (swipeRef.current?.axis === 'x') event.preventDefault()
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => window.removeEventListener('touchmove', onTouchMove)
  }, [])

  useEffect(() => {
    if (!openSwipeId && !swipeId) return
    function onDocPointerDown(event: globalThis.PointerEvent) {
      const list = listRef.current
      if (list && event.target instanceof Node && list.contains(event.target)) return
      closeSwipe()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [openSwipeId, swipeId])

  useEffect(() => {
    if (openSwipeId && !categories.some((row) => row.id === openSwipeId)) closeSwipe()
  }, [categories, openSwipeId])

  async function persist(nextIds: string[]) {
    if (sameCategoryOrder(nextIds, liveIdsRef.current)) return
    savingRef.current = true
    setDraftIds(nextIds)
    try {
      const cloudError = await reorderCategories(nextIds)
      if (cloudError) onCloudWarning(cloudError)
      else onSaved('Category order saved')
    } catch (err) {
      setDraft(null)
      draftRef.current = null
      onError(err instanceof Error ? err.message : 'Could not reorder')
    } finally {
      savingRef.current = false
    }
  }

  function setDraftIds(nextIds: string[]) {
    draftRef.current = nextIds
    orderedIdsRef.current = nextIds
    setDraft(nextIds)
  }

  function clearPress() {
    const press = pressRef.current
    if (press) window.clearTimeout(press.timer)
    pressRef.current = null
  }

  function targetFromPointer(clientY: number) {
    const list = listRef.current
    const drag = dragRef.current
    if (!list || !drag) return 0
    const top = list.getBoundingClientRect().top
    let y = clientY - top
    let acc = 0
    for (let i = 0; i < drag.heights.length; i++) {
      const height = drag.heights[i]
      if (y < acc + height / 2) return i
      acc += height
    }
    return Math.max(0, drag.heights.length - 1)
  }

  function shiftY(index: number) {
    const drag = dragRef.current
    if (!drag || index === drag.originIndex) return 0
    const hole = drag.heights[drag.originIndex] ?? 0
    if (drag.originIndex < targetIndex && index > drag.originIndex && index <= targetIndex) {
      return -hole
    }
    if (drag.originIndex > targetIndex && index >= targetIndex && index < drag.originIndex) {
      return hole
    }
    return 0
  }

  function closeSwipe() {
    swipeRef.current = null
    swipeOffsetRef.current = 0
    setSwipeId(null)
    setSwipeOffset(0)
    setOpenSwipeId(null)
  }

  function swipeFor(id: string) {
    if (swipeId === id) return swipeOffset
    return openSwipeId === id ? SWIPE_WIDTH : 0
  }

  function measureSwipeWidth(id: string) {
    const item = listRef.current?.querySelector(`[data-cat-id="${CSS.escape(id)}"] .${styles.swipeDelete}`)
    if (!(item instanceof HTMLElement)) return SWIPE_WIDTH
    const width = item.getBoundingClientRect().width
    return width > 0 ? width : SWIPE_WIDTH
  }

  function askRemove(cat: CategoryRow) {
    closeSwipe()
    setPendingDelete(cat)
  }

  async function confirmDelete() {
    const cat = pendingDelete
    if (!cat || deleteBusy) return
    setDeleteBusy(true)
    try {
      const cloudError = await deleteCategory(cat.id)
      setPendingDelete(null)
      if (cloudError) onCloudWarning(cloudError)
      else onSaved('Category removed')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete')
    } finally {
      setDeleteBusy(false)
    }
  }

  function onSwipePointerDown(event: PointerEvent<HTMLDivElement>, cat: CategoryRow) {
    if (event.button !== 0 || savingRef.current || dragRef.current || deleteBusy) return
    if (event.target instanceof Element && event.target.closest(`.${styles.handle}`)) return
    ignoreClickRef.current = false
    if (openSwipeId && openSwipeId !== cat.id) {
      setOpenSwipeId(null)
    }
    const width = measureSwipeWidth(cat.id)
    swipeRef.current = {
      id: cat.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: openSwipeId === cat.id ? width : 0,
      width,
      axis: null,
    }
  }

  function onSwipePointerMove(event: PointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    if (!swipe || swipe.pointerId !== event.pointerId || dragRef.current) return
    const dx = event.clientX - swipe.startX
    const dy = event.clientY - swipe.startY
    if (!swipe.axis) {
      if (Math.abs(dx) < SWIPE_LOCK && Math.abs(dy) < SWIPE_LOCK) return
      swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (swipe.axis === 'y') return
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        swipeRef.current = null
        return
      }
      setSwipeId(swipe.id)
    }
    if (swipe.axis !== 'x') return
    event.preventDefault()
    const next = clampSwipe(swipe.startOffset - dx, swipe.width)
    swipeOffsetRef.current = next
    setSwipeOffset(next)
  }

  function onSwipePointerUp(event: PointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    if (!swipe || swipe.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    swipeRef.current = null
    if (swipe.axis !== 'x') {
      if (Math.abs(event.clientY - swipe.startY) >= SWIPE_LOCK) ignoreClickRef.current = true
      setSwipeId(null)
      return
    }
    ignoreClickRef.current = true
    const open = swipeOffsetRef.current >= swipe.width * SWIPE_OPEN_RATIO
    swipeOffsetRef.current = 0
    setSwipeId(null)
    setSwipeOffset(0)
    setOpenSwipeId(open ? swipe.id : null)
  }

  function startDrag(target: HTMLButtonElement, id: string, pointerId: number, startY: number) {
    closeSwipe()
    clearPress()
    if (dragRef.current) return
    const list = listRef.current
    const row = target.closest('[data-cat-id]')
    if (!list || !(row instanceof HTMLElement)) return
    if (!target.hasPointerCapture(pointerId)) {
      try {
        target.setPointerCapture(pointerId)
      } catch {
        return
      }
    }
    const items = [...list.querySelectorAll<HTMLElement>('[data-cat-id]')]
    const originIds = items.map((el) => el.dataset.catId ?? '')
    const heights = items.map((el) => el.getBoundingClientRect().height)
    const originIndex = originIds.indexOf(id)
    if (originIndex < 0) return
    dragRef.current = {
      id,
      startY,
      originIndex,
      originIds,
      heights,
      targetIndex: originIndex,
    }
    setDragId(id)
    setDeltaY(0)
    setTargetIndex(originIndex)
  }

  function moveDrag(clientY: number) {
    const drag = dragRef.current
    if (!drag) return
    const nextIndex = targetFromPointer(clientY)
    drag.targetIndex = nextIndex
    setDeltaY(clientY - drag.startY)
    setTargetIndex(nextIndex)
  }

  function finishDrag() {
    clearPress()
    const drag = dragRef.current
    if (!drag) return
    const nextIds = insertCategoryIdAt(drag.originIds, drag.id, drag.targetIndex)
    dragRef.current = null
    setDragId(null)
    setDeltaY(0)
    setTargetIndex(0)
    void persist(nextIds)
  }

  function onHandlePointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || savingRef.current || dragRef.current) return
    event.preventDefault()
    clearPress()
    const target = event.currentTarget
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      return
    }
    pressRef.current = {
      id,
      pointerId: event.pointerId,
      lastY: event.clientY,
      timer: window.setTimeout(() => {
        const press = pressRef.current
        if (!press || press.id !== id) return
        startDrag(target, id, press.pointerId, press.lastY)
      }, HOLD_MS),
    }
  }

  function onHandlePointerMove(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (dragRef.current) {
      event.preventDefault()
      moveDrag(event.clientY)
      return
    }
    const press = pressRef.current
    if (!press || press.id !== id || press.pointerId !== event.pointerId) return
    press.lastY = event.clientY
  }

  function onHandlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragRef.current) finishDrag()
    else clearPress()
  }

  function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    event.preventDefault()
    void persist(moveCategoryId(orderedIdsRef.current, id, delta))
  }

  return (
    <>
      <div ref={listRef} className={styles.catList} data-reordering={dragId ? 'true' : 'false'}>
        {rows.map((cat, index) => {
          const dragging = dragId === cat.id
          const shift = dragging ? 0 : shiftY(index)
          const swipe = dragging ? 0 : swipeFor(cat.id)
          const revealOpen = swipe >= SWIPE_WIDTH * SWIPE_OPEN_RATIO
          return (
            <div
              key={cat.id}
              data-cat-id={cat.id}
              data-dragging={dragging ? 'true' : 'false'}
              className={styles.catItem}
              style={
                dragging
                  ? { transform: `translateY(${deltaY}px)` }
                  : dragId
                    ? { transform: `translateY(${shift}px)` }
                    : undefined
              }
            >
              <button
                type="button"
                className={styles.swipeDelete}
                tabIndex={revealOpen ? 0 : -1}
                aria-hidden={!revealOpen}
                aria-label={`Remove ${cat.name}`}
                disabled={Boolean(dragId) || deleteBusy}
                onClick={() => askRemove(cat)}
              >
                <span aria-hidden="true" className={styles.swipeDeleteIcon}>
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path
                      fill="currentColor"
                      d="M9.2 3h5.6l.8 2H20v2H4V5h4.4l.8-2zM8 9h2v9H8V9zm3 0h2v9h-2V9zm3 0h2v9h-2V9zM7 21h10a1 1 0 0 0 1-1V8H6v12a1 1 0 0 0 1 1z"
                    />
                  </svg>
                </span>
                Remove
              </button>
              <div
                className={`group-row ${styles.catFront}`}
                data-swipe-animate={swipeId === cat.id ? 'false' : 'true'}
                style={{ transform: `translateX(${-swipe}px)` }}
                onPointerDown={(event) => onSwipePointerDown(event, cat)}
                onPointerMove={onSwipePointerMove}
                onPointerUp={onSwipePointerUp}
                onPointerCancel={onSwipePointerUp}
              >
                <button
                  type="button"
                  className={styles.handle}
                  aria-label={`Reorder ${cat.name}`}
                  aria-grabbed={dragging ? 'true' : 'false'}
                  draggable={false}
                  onPointerDown={(event) => onHandlePointerDown(event, cat.id)}
                  onPointerMove={(event) => onHandlePointerMove(event, cat.id)}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                  onContextMenu={(event) => event.preventDefault()}
                  onKeyDown={(event) => onHandleKeyDown(event, cat.id)}
                >
                  <span aria-hidden="true">☰</span>
                </button>
                <button
                  type="button"
                  className={styles.catEdit}
                  aria-label={`Edit ${cat.name}`}
                  disabled={Boolean(dragId)}
                  onClick={() => {
                    if (ignoreClickRef.current) {
                      ignoreClickRef.current = false
                      return
                    }
                    if (openSwipeId === cat.id) {
                      closeSwipe()
                      return
                    }
                    closeSwipe()
                    onEdit(cat)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Delete' && event.key !== 'Backspace') return
                    event.preventDefault()
                    askRemove(cat)
                  }}
                >
                  <strong
                    data-tone={toneForCategory(cat)}
                    style={categoryChromeStyle(colorForCategory(cat))}
                  >
                    <span aria-hidden="true">{iconForCategory(cat)} </span>
                    {cat.name}
                  </strong>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <BottomSheet
        open={Boolean(pendingDelete)}
        title="Remove category"
        onClose={() => {
          if (deleteBusy) return
          setPendingDelete(null)
        }}
      >
        <p className={`page-sub ${styles.confirmCopy}`}>
          Remove {pendingDelete?.name}? Specimens stay in your collection. Only this dex track goes
          away.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn"
            disabled={deleteBusy}
            onClick={() => setPendingDelete(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={deleteBusy}
            onClick={() => void confirmDelete()}
          >
            {deleteBusy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </BottomSheet>
    </>
  )
}

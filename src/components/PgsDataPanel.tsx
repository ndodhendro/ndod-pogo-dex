import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  colorForCategory,
  iconForCategory,
  toneForCategory,
} from '../data/navIcons'
import { insertCategoryIdAt, moveCategoryId } from '../lib/categoryOrder'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { db, type CategoryRow } from '../lib/db'
import {
  matchFeedCategory,
  rebuildSummary,
  type PgsFeed,
} from '../lib/pgsdata/feeds'
import {
  downloadBytes,
  fillPgsFeeds,
  openPgsData,
  packPgsData,
} from '../lib/pgsdata/sync'
import type { HashMapPayload } from '../lib/pgsdata/javaHashMap'
import { useToast } from '../lib/toast'
import { FilePickerButton } from './FilePickerButton'
import styles from './PgsDataPanel.module.css'

const HOLD_MS = 500

type FeedRow = {
  id: string
  feed: PgsFeed
}

function pokemonCount(feed: PgsFeed) {
  return Array.isArray(feed.pokemons) ? feed.pokemons.length : 0
}

function nextRowId(index: number) {
  return `feed-${index}`
}

function rowsFromFeeds(feeds: PgsFeed[]): FeedRow[] {
  return feeds.map((feed, index) => ({ id: nextRowId(index), feed }))
}

export function PgsDataPanel() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'open' | 'pack' | null>(null)
  const [payload, setPayload] = useState<HashMapPayload | null>(null)
  const [rows, setRows] = useState<FeedRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file || busy) return
    setBusy('open')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const [specimens, nextCategories, catalogs, roster] = await Promise.all([
        db.specimens.toArray(),
        db.categories.toArray(),
        db.tagCatalogs.toArray(),
        db.tagRoster.toArray(),
      ])
      const opened = openPgsData(bytes)
      const filled = fillPgsFeeds(opened.feeds, specimens, nextCategories, catalogs, roster)
      setPayload(opened.payload)
      setCategories(nextCategories)
      setRows(rowsFromFeeds(filled.feeds))
      showToast(`Opened PGSData. ${rebuildSummary(filled.stats)}.`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open PGSData')
    } finally {
      setBusy(null)
    }
  }

  async function pack() {
    if (!payload || rows.length === 0 || busy) return
    setBusy('pack')
    try {
      const feeds = rows.map((row) => row.feed)
      const packed = packPgsData(payload, feeds)
      downloadBytes('PGSData.dat', packed.bytes)
      showToast('Packed PGSData. Download started.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not pack PGSData')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <p className={`page-sub ${styles.help}`}>
        Open a PGSData.dat to fill nearby feeds from species that are not yet pure. Drag to set pack
        order, then pack the file.
      </p>
      <div className="stack-actions">
        <FilePickerButton
          className="btn"
          icon="📥"
          label={busy === 'open' ? 'Opening…' : 'Open PGSData'}
          disabled={Boolean(busy)}
          accept=".dat,application/octet-stream"
          multiple={false}
          onFiles={onFiles}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!payload || Boolean(busy)}
          onClick={() => void pack()}
        >
          <span aria-hidden="true">📦</span>
          {busy === 'pack' ? 'Packing…' : 'Pack PGSData'}
        </button>
      </div>
      {rows.length > 0 ? (
        <FeedOrderList
          rows={rows}
          categories={categories}
          disabled={Boolean(busy)}
          onReorder={setRows}
        />
      ) : null}
    </div>
  )
}

function FeedOrderList({
  rows,
  categories,
  disabled,
  onReorder,
}: {
  rows: FeedRow[]
  categories: CategoryRow[]
  disabled: boolean
  onReorder: (next: FeedRow[]) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef(rows)
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
  const [dragId, setDragId] = useState<string | null>(null)
  const [deltaY, setDeltaY] = useState(0)
  const [targetIndex, setTargetIndex] = useState(0)

  rowsRef.current = rows
  const byId = new Map(rows.map((row) => [row.id, row]))
  const displayIds = dragId && dragRef.current ? dragRef.current.originIds : rows.map((row) => row.id)
  const visible = displayIds.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })

  useEffect(
    () => () => {
      const press = pressRef.current
      if (press) window.clearTimeout(press.timer)
    },
    [],
  )

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

  function persist(nextIds: string[]) {
    const current = rowsRef.current
    const map = new Map(current.map((row) => [row.id, row]))
    onReorder(nextIds.flatMap((id) => (map.get(id) ? [map.get(id)!] : [])))
  }

  function startDrag(target: HTMLButtonElement, id: string, pointerId: number, startY: number) {
    clearPress()
    if (dragRef.current || disabled) return
    const list = listRef.current
    const row = target.closest('[data-feed-id]')
    if (!list || !(row instanceof HTMLElement)) return
    if (!target.hasPointerCapture(pointerId)) {
      try {
        target.setPointerCapture(pointerId)
      } catch {
        return
      }
    }
    const items = [...list.querySelectorAll<HTMLElement>('[data-feed-id]')]
    const originIds = items.map((el) => el.dataset.feedId ?? '')
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
    persist(nextIds)
  }

  function onHandlePointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || disabled || dragRef.current) return
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
    if (!delta || disabled) return
    event.preventDefault()
    persist(moveCategoryId(rowsRef.current.map((row) => row.id), id, delta))
  }

  return (
    <div ref={listRef} className={styles.list} data-reordering={dragId ? 'true' : 'false'}>
      {visible.map((row, index) => {
        const name = String(row.feed.name ?? 'Untitled feed')
        const category = matchFeedCategory(name, categories)
        const dragging = dragId === row.id
        const shift = dragging ? 0 : shiftY(index)
        const count = pokemonCount(row.feed)
        return (
          <div
            key={row.id}
            data-feed-id={row.id}
            data-dragging={dragging ? 'true' : 'false'}
            className={styles.item}
            style={
              dragging
                ? { transform: `translateY(${deltaY}px)` }
                : dragId
                  ? { transform: `translateY(${shift}px)` }
                  : undefined
            }
          >
            <div className={`group-row ${styles.front}`}>
              <button
                type="button"
                className={styles.handle}
                aria-label={`Reorder ${name}`}
                aria-grabbed={dragging ? 'true' : 'false'}
                disabled={disabled}
                draggable={false}
                onPointerDown={(event) => onHandlePointerDown(event, row.id)}
                onPointerMove={(event) => onHandlePointerMove(event, row.id)}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
                onContextMenu={(event) => event.preventDefault()}
                onKeyDown={(event) => onHandleKeyDown(event, row.id)}
              >
                <span aria-hidden="true">☰</span>
              </button>
              <div className={styles.body}>
                <strong
                  className={styles.name}
                  data-tone={category ? toneForCategory(category) : 'settings'}
                  style={category ? categoryChromeStyle(colorForCategory(category)) : undefined}
                >
                  <span aria-hidden="true">{category ? iconForCategory(category) : '📋'} </span>
                  {name}
                </strong>
                <span className={styles.count}>
                  {category ? `${count} Pokémon` : 'Skipped'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

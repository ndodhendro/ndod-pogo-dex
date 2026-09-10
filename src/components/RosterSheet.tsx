import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { SPECIES_BY_ID, searchSpecies } from '../data/species'
import { addRosterEntry, removeRosterEntry } from '../lib/collection'
import { db } from '../lib/db'
import {
  normalizeVariant,
  slotBoxLabel,
  slotDisplayName,
  slotIsStaticReleased,
  staticReleasedCount,
  tagUsesStaticReleasedList,
  type SlotMode,
} from '../lib/roster'
import { toastAfterWrite, useToast } from '../lib/toast'
import type { TagId } from '../lib/tags'
import { BottomSheet } from './BottomSheet'
import { SearchField } from './SearchField'
import styles from './RosterSheet.module.css'

function speciesBoxLabel(species: { id: number; name: string }) {
  return `#${String(species.id).padStart(4, '0')} ${species.name}`
}

type Props = {
  open: boolean
  tag: TagId | null
  slotMode: SlotMode
  title: string
  onClose: () => void
}

export function RosterSheet({
  open,
  tag,
  slotMode,
  title,
  onClose,
}: Props) {
  const { showToast } = useToast()
  const rows = useLiveQuery(() => (tag ? db.tagRoster.where('tag').equals(tag).toArray() : []), [tag]) ?? []
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesId, setSpeciesId] = useState(0)
  const [variant, setVariant] = useState('')
  const [released, setReleased] = useState(true)
  const [busy, setBusy] = useState(false)

  const selected = speciesId ? SPECIES_BY_ID.get(speciesId) : undefined
  const selectedLabel = selected ? speciesBoxLabel(selected) : ''
  const speciesMatches = useMemo(() => {
    if (!adding || !speciesQuery.trim() || speciesQuery === selectedLabel) return []
    return searchSpecies(speciesQuery).slice(0, 12)
  }, [adding, speciesQuery, selectedLabel])

  const usesGoList = tag ? tagUsesStaticReleasedList(tag) : false
  const extraRows = useMemo(() => {
    if (!tag || !usesGoList) return rows
    return rows.filter((row) => !slotIsStaticReleased(tag, row.speciesId, row.variant))
  }, [rows, tag, usesGoList])
  const releasedCount = tag && usesGoList
    ? staticReleasedCount(tag, slotMode) + extraRows.length
    : rows.length
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...extraRows].sort(
      (a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant),
    )
    if (!q) return list
    return list.filter((row) => {
      const name = slotDisplayName(row.speciesId, row.variant).toLowerCase()
      const id = String(row.speciesId)
      return name.includes(q) || id === q || id.padStart(4, '0') === q.padStart(4, '0')
    })
  }, [extraRows, query])

  function resetAdd() {
    setAdding(false)
    setSpeciesQuery('')
    setSpeciesId(0)
    setVariant('')
    setReleased(true)
  }

  function close() {
    resetAdd()
    setQuery('')
    onClose()
  }

  async function addEntry() {
    if (!tag || busy) return
    if (!speciesId) {
      showToast('Pick a species first', 'warning')
      return
    }
    if (slotMode === 'variant' && !normalizeVariant(variant)) {
      showToast('Enter a variant name', 'warning')
      return
    }
    if (!released) {
      showToast('Unreleased species stay out of this Pokédex', 'warning')
      return
    }
    setBusy(true)
    try {
      const cloudError = await addRosterEntry(tag, speciesId, slotMode === 'variant' ? variant : '')
      toastAfterWrite(showToast, 'Pokédex updated', cloudError)
      resetAdd()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add to Pokédex')
    } finally {
      setBusy(false)
    }
  }

  async function setReleasedFlag(species: number, rowVariant: string, next: boolean) {
    if (!tag || busy) return
    setBusy(true)
    try {
      const cloudError = next
        ? await addRosterEntry(tag, species, rowVariant)
        : await removeRosterEntry(tag, species, rowVariant)
      toastAfterWrite(showToast, next ? 'Marked Released' : 'Marked Unreleased', cloudError)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update Pokédex')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} title={title} nested showClose={false} onClose={close}>
      <p className="page-sub">
        {usesGoList
          ? `${releasedCount} released from the Pokémon GO list. Add a species here if it debuted after that list.`
          : `${rows.length} released. Only these slots appear in Pokédex and Transfer.`}
      </p>
      <SearchField value={query} onChange={setQuery} placeholder="Filter species" />
      {adding ? (
        <div className={styles.addForm}>
          <SearchField
            value={speciesQuery}
            onChange={(value) => {
              setSpeciesQuery(value)
              if (selected && value === selectedLabel) return
              setSpeciesId(0)
            }}
            placeholder="Pokédex number or name"
          />
          {speciesMatches.length > 0 ? (
            <div className={styles.matches}>
              {speciesMatches.map((species) => (
                <button
                  key={species.id}
                  type="button"
                  data-on={speciesId === species.id ? 'true' : 'false'}
                  onClick={() => {
                    setSpeciesId(species.id)
                    setSpeciesQuery(speciesBoxLabel(species))
                  }}
                >
                  {speciesBoxLabel(species)}
                </button>
              ))}
            </div>
          ) : null}
          {selected ? (
            <p className={styles.picked}>
              <span>Name</span>
              {selected.name}
            </p>
          ) : null}
          {slotMode === 'variant' ? (
            <label className="field">
              <span>Variant</span>
              <input
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="Party Hat"
                autoComplete="off"
              />
            </label>
          ) : null}
          <div className="field">
            <span>Status</span>
            <div className={styles.segment}>
              <button
                type="button"
                data-on={released ? 'true' : 'false'}
                onClick={() => setReleased(true)}
              >
                Released
              </button>
              <button
                type="button"
                data-on={!released ? 'true' : 'false'}
                onClick={() => setReleased(false)}
              >
                Unreleased
              </button>
            </div>
          </div>
          <div className={styles.addActions}>
            <button type="button" className="btn" onClick={resetAdd}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addEntry()}>
              {busy ? 'Saving…' : 'Add to Pokédex'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`btn btn-primary ${styles.add}`} onClick={() => setAdding(true)}>
          <span aria-hidden="true">➕</span>
          Add species
        </button>
      )}
      {visible.length === 0 ? (
        <p className="empty-state">
          {usesGoList
            ? 'No extra species yet. The Pokémon GO list is already in this Pokédex.'
            : 'No released species yet.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((row) => (
            <li key={`${row.speciesId}:${row.variant}`}>
              <span className={styles.rowLabel}>
                {slotBoxLabel({
                  speciesId: row.speciesId,
                  variant: row.variant,
                  name: slotDisplayName(row.speciesId, row.variant),
                })}
              </span>
              <div className={styles.segment}>
                <button
                  type="button"
                  data-on="true"
                  disabled={busy}
                  onClick={() => void setReleasedFlag(row.speciesId, row.variant, true)}
                >
                  Released
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setReleasedFlag(row.speciesId, row.variant, false)}
                >
                  Unreleased
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}

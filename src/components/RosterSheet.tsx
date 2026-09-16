import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { SPECIES_BY_ID, searchSpecies } from '../data/species'
import { addRosterEntry, removeRosterEntry } from '../lib/collection'
import { db } from '../lib/db'
import {
  catalogForTag,
  extraCartesianSlots,
  normalizeVariant,
  searchVariantNames,
  slotBoxLabel,
  slotDisplayName,
  slotIsStaticReleased,
  slotsForTrack,
  staticReleasedCount,
  tagUsesStaticReleasedList,
  uniqueVariantNamesForTag,
} from '../lib/roster'
import { toastAfterWrite, useToast } from '../lib/toast'
import { labelForTag, type TagId } from '../lib/tags'
import { BottomSheet } from './BottomSheet'
import { SearchField } from './SearchField'
import styles from './RosterSheet.module.css'

function speciesBoxLabel(species: { id: number; name: string }) {
  return `#${String(species.id).padStart(4, '0')} ${species.name}`
}

type Props = {
  open: boolean
  tags: TagId[]
  title: string
  onClose: () => void
}

export function RosterSheet({ open, tags, title, onClose }: Props) {
  const { showToast } = useToast()
  const tagsKey = tags.join('|')
  const rows =
    useLiveQuery(
      () => (tags.length ? db.tagRoster.where('tag').anyOf([...tags]).toArray() : []),
      [tagsKey],
    ) ?? []
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? []
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesId, setSpeciesId] = useState(0)
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [released, setReleased] = useState(true)
  const [busy, setBusy] = useState(false)

  const tag = tags.length === 1 ? tags[0] : null
  const variantTags = useMemo(
    () => tags.filter((item) => catalogForTag(catalogs, item).slotMode === 'variant'),
    [tags, catalogs],
  )
  const comboMode = variantTags.length > 1
  const selected = speciesId ? SPECIES_BY_ID.get(speciesId) : undefined
  const selectedLabel = selected ? speciesBoxLabel(selected) : ''
  const speciesMatches = useMemo(() => {
    if (!adding || !speciesQuery.trim() || speciesQuery === selectedLabel) return []
    return searchSpecies(speciesQuery).slice(0, 12)
  }, [adding, speciesQuery, selectedLabel])

  const usesGoList = comboMode
    ? tags.every((item) => tagUsesStaticReleasedList(item))
    : tag
      ? tagUsesStaticReleasedList(tag)
      : false
  const extraRows = useMemo(() => {
    if (comboMode) return []
    if (!tag || !usesGoList) return rows
    return rows.filter((row) => !slotIsStaticReleased(tag, row.speciesId, row.variant))
  }, [rows, tag, usesGoList, comboMode])
  const extraCombos = useMemo(
    () => (comboMode ? extraCartesianSlots(tags, catalogs, rows) : []),
    [comboMode, tags, catalogs, rows],
  )
  const releasedCount = comboMode
    ? slotsForTrack(tags, catalogs, rows).length
    : tag && usesGoList
      ? staticReleasedCount(tag, catalogForTag(catalogs, tag).slotMode) + extraRows.length
      : rows.length
  const visibleCombos = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...extraCombos].sort(
      (a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant),
    )
    if (!q) return list
    return list.filter((slot) => {
      const name = slot.name.toLowerCase()
      const id = String(slot.speciesId)
      return name.includes(q) || id === q || id.padStart(4, '0') === q.padStart(4, '0')
    })
  }, [extraCombos, query])
  const visibleRows = useMemo(() => {
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
  const visibleCount = comboMode ? visibleCombos.length : visibleRows.length

  function resetAdd() {
    setAdding(false)
    setSpeciesQuery('')
    setSpeciesId(0)
    setVariants({})
    setReleased(true)
  }

  function close() {
    resetAdd()
    setQuery('')
    onClose()
  }

  function comboAlreadyReleased() {
    const parts = variantTags.map((item) => ({
      tag: item,
      speciesId,
      variant: normalizeVariant(variants[item]),
    }))
    if (parts.some((part) => !part.variant)) return false
    const preview = [...rows, ...parts]
    if (!slotsForTrack(tags, catalogs, preview).some((slot) => slot.speciesId === speciesId)) {
      return false
    }
    return extraCartesianSlots(tags, catalogs, preview).length === extraCartesianSlots(tags, catalogs, rows).length
  }

  async function addEntry() {
    if (!tags.length || busy) return
    if (!speciesId) {
      showToast('Pick a species first', 'warning')
      return
    }
    for (const item of variantTags) {
      if (!normalizeVariant(variants[item])) {
        showToast(`Enter a ${labelForTag(item)} variant`, 'warning')
        return
      }
    }
    if (!released) {
      showToast('Unreleased species stay out of this Pokédex', 'warning')
      return
    }
    if (comboAlreadyReleased()) {
      showToast('Already in this Pokédex', 'warning')
      return
    }
    setBusy(true)
    try {
      let cloudError: string | undefined
      if (variantTags.length === 0 && tag) {
        cloudError = await addRosterEntry(tag, speciesId, '')
      } else {
        for (const item of variantTags) {
          cloudError = (await addRosterEntry(item, speciesId, variants[item])) ?? cloudError
        }
      }
      toastAfterWrite(showToast, 'Pokédex updated', cloudError)
      resetAdd()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add to Pokédex')
    } finally {
      setBusy(false)
    }
  }

  async function setReleasedFlag(species: number, rowVariant: string, next: boolean) {
    if (!tag || busy || comboMode) return
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
        {comboMode
          ? `${releasedCount} combined slots from those lists. Add a species here if a combo is missing, like Pikachu Kurta Male or Pumpkaboo Large Variety Halloween Party.`
          : usesGoList
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
          {variantTags.map((item) => {
            const names = uniqueVariantNamesForTag(item, rows)
            const value = variants[item] ?? ''
            const matches = searchVariantNames(names, value)
            return (
              <div key={item} className={styles.addField}>
                <span>{labelForTag(item)} variant</span>
                <SearchField
                  value={value}
                  onChange={(next) => setVariants((current) => ({ ...current, [item]: next }))}
                  placeholder="Search or type a variant"
                  aria-label={`${labelForTag(item)} variant`}
                />
                {matches.length > 0 ? (
                  <div className={styles.matches}>
                    {matches.map((name) => (
                      <button
                        key={name}
                        type="button"
                        data-on={value === name ? 'true' : 'false'}
                        onClick={() => setVariants((current) => ({ ...current, [item]: name }))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
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
          <div className="row-actions">
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
      {visibleCount === 0 ? (
        <p className="empty-state">
          {usesGoList
            ? comboMode
              ? 'No extra combos yet. Gender × Costume and forme × Costume from the Pokémon GO lists are already in this Pokédex.'
              : 'No extra species yet. The Pokémon GO list is already in this Pokédex.'
            : 'No released species yet.'}
        </p>
      ) : comboMode ? (
        <ul className={styles.list}>
          {visibleCombos.map((slot) => (
            <li key={`${slot.speciesId}:${slot.variant}`}>
              <span className={styles.rowLabel}>{slotBoxLabel(slot)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.list}>
          {visibleRows.map((row) => (
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

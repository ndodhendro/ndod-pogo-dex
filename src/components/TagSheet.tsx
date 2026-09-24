import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, SEEN_ICON, NOT_PURE_ICON, specimenTagChoices } from '../data/navIcons'
import { comboCropsAtHeight, cropHeightForSpecimen, matchingComboCrops } from '../data/tagCrops'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { useTagCropHeights } from '../hooks/useCropSettings'
import { deleteSpecimen, replaceSpecimenLook, updateSpecimen } from '../lib/collection'
import { db, type SpecimenRow } from '../lib/db'
import { cropBottomFromBlob, SCREENSHOT_WIDTH } from '../lib/images'
import {
  applyRosterSlot,
  limitedRosterWarning,
  normalizeVariant,
  searchSlots,
  slotBoxLabel,
  slotDisplayName,
  specimenSlotBoxLabel,
  slotsForSelectedTags,
  variantFieldComesFromSlot,
  type DexSlotDef,
} from '../lib/roster'
import { parseCropBottom } from '../lib/screenshotCrop'
import { readPokemonName } from '../lib/screenshotOcr'
import {
  applyOcrGenderSpecies,
  genderSlotsForSpecies,
  isGenderDexSpecies,
  matchSpeciesFromOcr,
  ocrMatchesGenderSpecies,
  uniqueOcrSpeciesId,
} from '../lib/speciesOcr'
import { toastAfterWrite, useToast } from '../lib/toast'
import {
  cropTagsFromFields,
  fieldsFromSpecimen,
  labelForTag,
  normalizeOptionalName,
  specimenSaveWarning,
  specimenTags,
  toggleTag,
  type SpecimenFields,
  type TagId,
} from '../lib/tags'
import { BottomSheet } from './BottomSheet'
import { FileNameCopy } from './FileNameCopy'
import { OriginalLightbox } from './OriginalLightbox'
import { SameLookSheet } from './SameLookSheet'
import { SearchField } from './SearchField'
import { TagChip } from './TagChip'
import styles from './TagSheet.module.css'

const emptyFields = (): SpecimenFields => ({
  speciesId: 0,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  gender: null,
  hundo: false,
  nundo: false,
  hokido: false,
  extraTags: ['basic'],
  silhouette: false,
  notPure: false,
})

function scrollOverflowParentToTop(start: HTMLElement | null) {
  let el: HTMLElement | null = start
  while (el) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      el.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
      return
    }
    el = el.parentElement
  }
}

function rosterVariantNames(
  roster: readonly { tag: string; speciesId: number; variant: string }[],
  tag: TagId,
  speciesId: number,
) {
  const names = new Set<string>()
  for (const row of roster) {
    if (row.tag !== tag) continue
    if (speciesId && row.speciesId !== speciesId) continue
    const name = normalizeVariant(row.variant)
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

function baseSpeciesBoxLabel(speciesId: number) {
  return slotBoxLabel({
    speciesId,
    variant: '',
    name: slotDisplayName(speciesId, ''),
  })
}

type SheetTab = 'tags' | 'crop'

type TagSheetProps = {
  open: boolean
  title: string
  resetKey: string
  imageId?: string
  fileName?: string | null
  initialFields?: SpecimenFields
  saveLabel: string
  tone: string
  nested?: boolean
  onClose: () => void
  onSave: (fields: SpecimenFields, cropBottom: number) => Promise<void>
  onWarning: (message: string) => void
  onError: (message: string) => void
}

export function TagSheet({
  open,
  title,
  resetKey,
  imageId,
  fileName,
  initialFields,
  saveLabel,
  tone,
  nested = false,
  onClose,
  onSave,
  onWarning,
  onError,
}: TagSheetProps) {
  const [tab, setTab] = useState<SheetTab>('tags')
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<SpecimenFields>(emptyFields)
  const [ocrHits, setOcrHits] = useState<DexSlotDef[] | null>(null)
  const [speciesMenuOpen, setSpeciesMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [heightDraft, setHeightDraft] = useState('710')
  const [storedCrop, setStoredCrop] = useState<number | null>(null)
  const sheetTopRef = useRef<HTMLDivElement>(null)
  const openedKey = useRef<string | null>(null)
  const keepStoredCrop = useRef(true)
  const heightTouched = useRef(false)
  const initialFieldsRef = useRef(initialFields)
  initialFieldsRef.current = initialFields
  const previewUrl = useImageUrl(imageId, 'original')
  const closeLightbox = useCallback(() => setLightbox(false), [])
  const heightMap = useTagCropHeights()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? []
  const roster = useLiveQuery(() => db.tagRoster.toArray(), []) ?? []
  const tagChoices = useMemo(() => specimenTagChoices(categories), [categories])
  const tags = specimenTags(fields)
  const cropTags = cropTagsFromFields(fields)
  const luckyCombo = !fields.silhouette && matchingComboCrops(cropTags).length > 0
  const suggestedHeight = cropHeightForSpecimen(
    cropTags,
    heightMap,
    Boolean(fields.silhouette),
  )
  const cropBottom = parseCropBottom(heightDraft, suggestedHeight)
  const selectedLabel = specimenSlotBoxLabel(fields, catalogs)
  const availableSlots = useMemo(
    () => slotsForSelectedTags(tags, catalogs, roster),
    [tags, catalogs, roster],
  )
  const costumeFromSlot = variantFieldComesFromSlot('costume', tags, catalogs, availableSlots)
  const backgroundFromSlot = variantFieldComesFromSlot(
    'background',
    tags,
    catalogs,
    availableSlots,
  )
  const costumeNames = useMemo(
    () => rosterVariantNames(roster, 'costume', fields.speciesId),
    [roster, fields.speciesId],
  )
  const backgroundNames = useMemo(
    () => rosterVariantNames(roster, 'background', fields.speciesId),
    [roster, fields.speciesId],
  )
  const genderChoices = useMemo(
    () => genderSlotsForSpecies(availableSlots, fields.speciesId),
    [availableSlots, fields.speciesId],
  )
  const matches = useMemo(() => {
    if (ocrHits) return ocrHits
    if (
      speciesMenuOpen &&
      tags.includes('gender') &&
      fields.speciesId &&
      (!query.trim() || query === selectedLabel)
    ) {
      return genderChoices
    }
    if (!query.trim() || query === selectedLabel) return []
    return searchSlots(availableSlots, query).slice(0, 12)
  }, [
    ocrHits,
    speciesMenuOpen,
    tags,
    fields.speciesId,
    query,
    selectedLabel,
    genderChoices,
    availableSlots,
  ])
  useEffect(() => {
    if (!open) {
      openedKey.current = null
      keepStoredCrop.current = true
      heightTouched.current = false
      setStoredCrop(null)
      setLightbox(false)
      return
    }
    setTab('tags')
    setBusy(false)
    setOcrBusy(false)
    setOcrHits(null)
    setSpeciesMenuOpen(false)
    setLightbox(false)
    keepStoredCrop.current = true
    const seed = initialFieldsRef.current
    const next = seed ? fieldsFromSpecimen(seed) : emptyFields()
    setFields(next)
    const species = next.speciesId ? SPECIES_BY_ID.get(next.speciesId) : undefined
    setQuery(species ? specimenSlotBoxLabel(next) : '')
  }, [open, resetKey])

  useEffect(() => {
    if (!open || !imageId || !initialFieldsRef.current) {
      setStoredCrop(null)
      return
    }
    let cancelled = false
    db.images
      .get(imageId)
      .then((row) => (row?.original ? cropBottomFromBlob(row.original) : null))
      .then((value) => {
        if (!cancelled) setStoredCrop(value)
      })
      .catch(() => {
        if (!cancelled) setStoredCrop(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, resetKey, imageId])

  useEffect(() => {
    if (!open) return
    if (openedKey.current !== resetKey) {
      openedKey.current = resetKey
      keepStoredCrop.current = true
      heightTouched.current = false
      setHeightDraft(String(storedCrop ?? suggestedHeight))
      return
    }
    if (keepStoredCrop.current && storedCrop != null) {
      keepStoredCrop.current = false
      heightTouched.current = false
      setHeightDraft(String(storedCrop))
      return
    }
    keepStoredCrop.current = false
    heightTouched.current = false
    setHeightDraft(String(suggestedHeight))
  }, [open, resetKey, suggestedHeight, storedCrop])

  useEffect(() => {
    if (!busy) return
    scrollOverflowParentToTop(sheetTopRef.current)
  }, [busy])

  async function runOcr() {
    if (!imageId || ocrBusy || busy) return
    setOcrBusy(true)
    try {
      const row = await db.images.get(imageId)
      if (!row?.original) throw new Error('No screenshot to read')
      const rawText = await readPokemonName(row.original)
      if (!rawText) throw new Error('Could not read a name')
      const result = matchSpeciesFromOcr(rawText, availableSlots)
      if (ocrMatchesGenderSpecies(result)) {
        const speciesId = uniqueOcrSpeciesId(result)
        if (speciesId) {
          setOcrHits(null)
          setSpeciesMenuOpen(false)
          setFields((current) => applyOcrGenderSpecies(current, speciesId))
          setQuery(baseSpeciesBoxLabel(speciesId))
          return
        }
      }
      if (result.kind === 'strong' && result.slot) {
        const slot = result.slot
        setOcrHits(null)
        setSpeciesMenuOpen(false)
        setFields((current) => applyRosterSlot(current, slot, specimenTags(current), catalogs))
        setQuery(slotBoxLabel(slot))
        return
      }
      setFields((current) => ({ ...current, speciesId: 0 }))
      setQuery(result.query)
      setOcrHits(result.kind === 'weak' ? result.suggestions : [])
      setSpeciesMenuOpen(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read a name')
    } finally {
      setOcrBusy(false)
    }
  }

  async function save() {
    let warning = specimenSaveWarning(fields)
    if (
      warning === 'Enter a costume name' &&
      variantFieldComesFromSlot('costume', tags, catalogs, availableSlots)
    ) {
      warning = 'Pick a released costume'
    } else if (
      warning === 'Enter a background name' &&
      variantFieldComesFromSlot('background', tags, catalogs, availableSlots)
    ) {
      warning = 'Pick a released background'
    } else if (warning === 'Pick a gender variant') {
      warning = 'Pick a released gender variant'
    }
    if (!warning) {
      warning = limitedRosterWarning(fields, catalogs, roster, (tag) =>
        categoryForTag(categories, tag)?.name ?? labelForTag(tag),
      )
    }
    if (warning) {
      onWarning(warning)
      return
    }
    setBusy(true)
    try {
      await onSave(
        {
          ...fields,
          costume: normalizeOptionalName(fields.costume),
          background: normalizeOptionalName(fields.background),
          gender: fields.gender != null ? normalizeOptionalName(fields.gender) : null,
        },
        cropBottom,
      )
      const comboTags = cropTagsFromFields(fields)
      const comboSuggestion = cropHeightForSpecimen(comboTags, heightMap, false)
      const winners = comboCropsAtHeight(comboTags, heightMap, comboSuggestion)
      if (
        heightTouched.current &&
        !fields.silhouette &&
        winners.length > 0 &&
        cropBottom !== comboSuggestion
      ) {
        await db.tagCrops.bulkPut(winners.map((row) => ({ tag: row.tag, height: cropBottom })))
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <BottomSheet open={open} title={title} nested={nested} showClose={false} onClose={onClose}>
      <div ref={sheetTopRef} className={styles.tabs} role="tablist" aria-label={title} data-tone={tone}>
        <button
          type="button"
          role="tab"
          data-tone={tone}
          data-on={tab === 'tags' ? 'true' : 'false'}
          aria-selected={tab === 'tags'}
          onClick={() => setTab('tags')}
        >
          <span aria-hidden="true">🏷️</span>
          Tags
        </button>
        <button
          type="button"
          role="tab"
          data-tone={tone}
          data-on={tab === 'crop' ? 'true' : 'false'}
          aria-selected={tab === 'crop'}
          onClick={() => setTab('crop')}
        >
          <span aria-hidden="true">✂️</span>
          Crop
        </button>
      </div>
      {tab === 'tags' ? (
        <>
          <div className={styles.shotBlock}>
            {previewUrl ? (
              <button
                type="button"
                className={styles.shotPreview}
                aria-label="View original screenshot"
                onClick={() => setLightbox(true)}
              >
                <img src={previewUrl} alt="" />
              </button>
            ) : null}
            <FileNameCopy fileName={fileName} size="md" className={styles.fileName} />
          </div>
          <div className="field">
            <span>Tags</span>
            <div className="chip-row">
              {tagChoices.map((choice) => (
                <TagChip
                  key={choice.tag ?? 'empty-look'}
                  tag={choice.tag ?? 'living'}
                  selected={choice.tag != null && tags.includes(choice.tag)}
                  icon={choice.icon}
                  label={choice.label}
                  labelColor={choice.labelColor}
                  onClick={() => {
                    if (choice.tag == null) return
                    setFields({ ...toggleTag(fields, choice.tag), speciesId: 0 })
                    setQuery('')
                    setOcrHits(null)
                    setSpeciesMenuOpen(false)
                  }}
                />
              ))}
            </div>
          </div>
          {fields.costume !== null && !costumeFromSlot ? (
            <label className="field">
              <span>Costume name</span>
              <input
                value={fields.costume}
                list="tag-costume-names"
                onChange={(e) => {
                  const costume = e.target.value
                  setFields((current) => {
                    const next = { ...current, costume }
                    const label = specimenSlotBoxLabel(next, catalogs)
                    if (label) setQuery(label)
                    return next
                  })
                }}
                placeholder="Party Hat"
              />
              {costumeNames.length > 0 ? (
                <datalist id="tag-costume-names">
                  {costumeNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </label>
          ) : null}
          {fields.background !== null && !backgroundFromSlot ? (
            <label className="field">
              <span>Background</span>
              <input
                value={fields.background}
                list="tag-background-names"
                onChange={(e) => {
                  const background = e.target.value
                  setFields((current) => {
                    const next = { ...current, background }
                    const label = specimenSlotBoxLabel(next, catalogs)
                    if (label) setQuery(label)
                    return next
                  })
                }}
                placeholder="Tokyo"
              />
              {backgroundNames.length > 0 ? (
                <datalist id="tag-background-names">
                  {backgroundNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </label>
          ) : null}
          <button
            type="button"
            className={`btn btn-ghost ${styles.ocr}`}
            data-tone={tone}
            disabled={ocrBusy || busy || !imageId}
            onClick={() => void runOcr()}
          >
            <span aria-hidden="true">🔍</span>
            {ocrBusy ? 'Reading…' : 'OCR'}
          </button>
          <SearchField
            value={query}
            onChange={(value) => {
              setOcrHits(null)
              setQuery(value)
              if (value !== selectedLabel) setSpeciesMenuOpen(false)
              setFields((f) => {
                if (!f.speciesId) return f
                if (value === specimenSlotBoxLabel(f, catalogs)) return f
                return { ...f, speciesId: 0 }
              })
            }}
            onFocus={() => {
              if (tags.includes('gender') && genderChoices.length > 0) setSpeciesMenuOpen(true)
            }}
            onClick={() => {
              if (tags.includes('gender') && genderChoices.length > 0) setSpeciesMenuOpen(true)
            }}
            placeholder="Species name or number"
          />
          {matches.length > 0 ? (
            <div className={styles.speciesList}>
              {matches.map((slot) => {
                const label = slotBoxLabel(slot)
                return (
                  <button
                    key={`${slot.speciesId}:${slot.variant}`}
                    type="button"
                    data-on={query === label ? 'true' : 'false'}
                    onClick={() => {
                      setOcrHits(null)
                      if (isGenderDexSpecies(slot.speciesId) && !normalizeVariant(slot.variant)) {
                        setSpeciesMenuOpen(true)
                        setFields((f) => applyOcrGenderSpecies(f, slot.speciesId))
                        setQuery(baseSpeciesBoxLabel(slot.speciesId))
                        return
                      }
                      setSpeciesMenuOpen(false)
                      setFields((f) => applyRosterSlot(f, slot, specimenTags(f), catalogs))
                      setQuery(label)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
          <label className={styles.checkRow}>
            <span className={styles.checkCopy}>
              <span aria-hidden="true">{SEEN_ICON}</span>
              Seen
            </span>
            <input
              type="checkbox"
              checked={Boolean(fields.silhouette)}
              onChange={(e) => setFields((f) => ({ ...f, silhouette: e.target.checked }))}
            />
          </label>
          <label className={styles.checkRow}>
            <span className={styles.checkCopy}>
              <span aria-hidden="true">{NOT_PURE_ICON}</span>
              Mark as not Pure
            </span>
            <input
              type="checkbox"
              checked={Boolean(fields.notPure)}
              onChange={(e) => setFields((f) => ({ ...f, notPure: e.target.checked }))}
            />
          </label>
        </>
      ) : (
        <>
          {previewUrl ? (
            <div
              className={styles.cropPreview}
              style={{ aspectRatio: `${SCREENSHOT_WIDTH} / ${cropBottom}` }}
            >
              <img src={previewUrl} alt="" />
            </div>
          ) : null}
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1600}
              value={heightDraft}
              onChange={(e) => {
                heightTouched.current = true
                setHeightDraft(e.target.value)
              }}
              onBlur={() => setHeightDraft(String(cropBottom))}
            />
          </label>
          <p className="page-sub">
            {fields.silhouette
              ? 'Seen always uses 710px. Changing this number crops this screenshot only.'
              : luckyCombo
                ? 'Uses the taller Lucky combination crop. Saving a different height updates that combination for the next screenshot and crops this one.'
                : 'Follows the tallest selected tag. Changing this number crops this screenshot only.'}
          </p>
        </>
      )}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : saveLabel}
      </button>
    </BottomSheet>
    {lightbox && previewUrl ? (
      <OriginalLightbox src={previewUrl} alt="" onClose={closeLightbox} />
    ) : null}
    </>
  )
}

export function SpecimenTagSheet({
  specimen,
  onClose,
  onSaved,
  onDiscarded,
}: {
  specimen: SpecimenRow | null
  onClose: () => void
  onSaved: (specimen: SpecimenRow) => void
  onDiscarded: () => void
}) {
  const { showToast } = useToast()
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    existing: SpecimenRow
    fields: SpecimenFields
    cropBottom: number
  } | null>(null)
  const [duplicateBusy, setDuplicateBusy] = useState(false)

  useEffect(() => {
    setPendingDuplicate(null)
    setDuplicateBusy(false)
  }, [specimen?.id])

  async function confirmDuplicateDiscard() {
    if (!pendingDuplicate || !specimen || duplicateBusy) return
    setDuplicateBusy(true)
    try {
      const cloudError = await deleteSpecimen(specimen.id)
      setPendingDuplicate(null)
      toastAfterWrite(showToast, 'Screenshot discarded', cloudError)
      onDiscarded()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not discard')
    } finally {
      setDuplicateBusy(false)
    }
  }

  async function confirmDuplicateReplace() {
    const pending = pendingDuplicate
    if (!pending || !specimen || duplicateBusy) return
    setDuplicateBusy(true)
    try {
      const result = await replaceSpecimenLook(
        specimen.id,
        pending.existing.id,
        pending.fields,
        pending.cropBottom,
      )
      setPendingDuplicate(null)
      if (result.cloudError) showToast(result.cloudError, 'warning')
      else showToast('Screenshot replaced', 'success')
      onSaved(result.specimen)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not replace')
    } finally {
      setDuplicateBusy(false)
    }
  }

  return (
    <>
    <TagSheet
      open={Boolean(specimen) && !pendingDuplicate}
      title="Edit tags"
      resetKey={specimen?.id ?? ''}
      imageId={specimen?.imageId}
      fileName={specimen?.fileName}
      initialFields={specimen ?? undefined}
      saveLabel="Save tags"
      tone="living"
      nested
      onClose={() => {
        if (pendingDuplicate) return
        onClose()
      }}
      onSave={async (fields, cropBottom) => {
        if (!specimen) return
        const result = await updateSpecimen(specimen.id, fields, cropBottom)
        if (result.duplicate && result.existing) {
          setPendingDuplicate({
            existing: result.existing,
            fields,
            cropBottom,
          })
          return
        }
        if (result.cloudError) showToast(result.cloudError, 'warning')
        else showToast('Tags saved', 'success')
        onSaved(result.specimen)
      }}
      onWarning={(message) => showToast(message, 'warning')}
      onError={(message) => showToast(message)}
    />
    <SameLookSheet
      open={Boolean(pendingDuplicate)}
      nested
      current={pendingDuplicate?.existing}
      next={
        specimen
          ? { imageId: specimen.imageId, fileName: specimen.fileName }
          : null
      }
      speciesId={pendingDuplicate?.existing.speciesId}
      nextTone="living"
      busy={duplicateBusy}
      onClose={() => {
        if (duplicateBusy) return
        setPendingDuplicate(null)
      }}
      onDiscard={() => void confirmDuplicateDiscard()}
      onReplace={() => void confirmDuplicateReplace()}
    />
    </>
  )
}

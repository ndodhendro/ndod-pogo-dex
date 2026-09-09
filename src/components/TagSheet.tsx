import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, specimenTagChoices } from '../data/navIcons'
import { cropHeightForTags } from '../data/tagCrops'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { useTagCropHeights } from '../hooks/useCropSettings'
import { updateSpecimen } from '../lib/collection'
import { db, type SpecimenRow } from '../lib/db'
import { cropBottomFromBlob, SCREENSHOT_WIDTH } from '../lib/images'
import {
  applyRosterSlot,
  canEnableLimitedTag,
  limitedRosterWarning,
  searchSlots,
  slotBoxLabel,
  slotDisplayName,
  slotsForSelectedTags,
  usesRosterVariantField,
} from '../lib/roster'
import { parseCropBottom } from '../lib/screenshotCrop'
import { useToast } from '../lib/toast'
import {
  clearVisualTags,
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
  hundo: false,
  nundo: false,
  extraTags: [],
  silhouette: false,
})

function selectedSlotLabel(fields: SpecimenFields, tags: TagId[]) {
  const species = fields.speciesId ? SPECIES_BY_ID.get(fields.speciesId) : undefined
  if (!species) return ''
  const variant =
    fields.costume?.trim() && tags.includes('costume')
      ? fields.costume.trim()
      : fields.background?.trim() && tags.includes('background')
        ? fields.background.trim()
        : tags.includes('alternate-forme') && fields.form?.trim()
          ? fields.form.trim()
          : ''
  return slotBoxLabel({
    speciesId: species.id,
    variant,
    name: slotDisplayName(species.id, variant),
  })
}

type SheetTab = 'tags' | 'crop'

type TagSheetProps = {
  open: boolean
  title: string
  resetKey: string
  imageId?: string
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
  const [busy, setBusy] = useState(false)
  const [heightDraft, setHeightDraft] = useState('710')
  const [storedCrop, setStoredCrop] = useState<number | null>(null)
  const openedKey = useRef<string | null>(null)
  const keepStoredCrop = useRef(true)
  const initialFieldsRef = useRef(initialFields)
  initialFieldsRef.current = initialFields
  const previewUrl = useImageUrl(imageId, 'original')
  const heightMap = useTagCropHeights()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? []
  const roster = useLiveQuery(() => db.tagRoster.toArray(), []) ?? []
  const tagChoices = useMemo(() => specimenTagChoices(categories), [categories])
  const tags = specimenTags(fields)
  const suggestedHeight = cropHeightForTags(cropTagsFromFields(fields), heightMap)
  const cropBottom = parseCropBottom(heightDraft, suggestedHeight)
  const selectedLabel = selectedSlotLabel(fields, tags)
  const availableSlots = useMemo(
    () => slotsForSelectedTags(tags, catalogs, roster),
    [tags, catalogs, roster],
  )
  const matches = useMemo(() => {
    if (!query.trim() || query === selectedLabel) return []
    return searchSlots(availableSlots, query).slice(0, 12)
  }, [query, selectedLabel, availableSlots])
  useEffect(() => {
    if (!open) {
      openedKey.current = null
      keepStoredCrop.current = true
      setStoredCrop(null)
      return
    }
    setTab('tags')
    setBusy(false)
    keepStoredCrop.current = true
    const seed = initialFieldsRef.current
    const next = seed ? fieldsFromSpecimen(seed) : emptyFields()
    setFields(next)
    const species = next.speciesId ? SPECIES_BY_ID.get(next.speciesId) : undefined
    setQuery(species ? selectedSlotLabel(next, specimenTags(next)) : '')
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
      setHeightDraft(String(storedCrop ?? suggestedHeight))
      return
    }
    if (keepStoredCrop.current && storedCrop != null) {
      keepStoredCrop.current = false
      setHeightDraft(String(storedCrop))
      return
    }
    keepStoredCrop.current = false
    setHeightDraft(String(suggestedHeight))
  }, [open, resetKey, suggestedHeight, storedCrop])

  async function save() {
    let warning = specimenSaveWarning(fields)
    if (warning === 'Enter a costume name' && usesRosterVariantField('costume', catalogs)) {
      warning = 'Pick a released costume'
    } else if (
      warning === 'Enter a background name' &&
      usesRosterVariantField('background', catalogs)
    ) {
      warning = 'Pick a released background'
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
        },
        cropBottom,
      )
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} title={title} nested={nested} onClose={onClose}>
      <div className={styles.tabs} role="tablist" aria-label={title} data-tone={tone}>
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
          {previewUrl ? (
            <div className={styles.shotPreview}>
              <img src={previewUrl} alt="" />
            </div>
          ) : null}
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value)
              setFields((f) => {
                if (!f.speciesId) return f
                if (value === selectedSlotLabel(f, specimenTags(f))) return f
                return { ...f, speciesId: 0 }
              })
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
          <div className="field">
            <span>Tags</span>
            <div className="chip-row">
              {tagChoices.map((choice) => (
                <TagChip
                  key={choice.tag ?? 'empty-look'}
                  tag={choice.tag ?? 'living'}
                  selected={choice.tag == null ? tags.length === 0 : tags.includes(choice.tag)}
                  icon={choice.icon}
                  label={choice.label}
                  labelColor={choice.labelColor}
                  onClick={() => {
                    if (choice.tag == null) {
                      setFields((f) => clearVisualTags(f))
                      return
                    }
                    const on = tags.includes(choice.tag)
                    if (!on && !canEnableLimitedTag(fields, choice.tag, catalogs, roster)) {
                      const name =
                        categoryForTag(categories, choice.tag)?.name ?? labelForTag(choice.tag)
                      onWarning(`Not in the ${name} Pokédex`)
                      return
                    }
                    setFields((f) => toggleTag(f, choice.tag as TagId))
                  }}
                />
              ))}
            </div>
          </div>
          {fields.costume !== null && !usesRosterVariantField('costume', catalogs) ? (
            <label className="field">
              <span>Costume name</span>
              <input
                value={fields.costume}
                onChange={(e) => setFields((f) => ({ ...f, costume: e.target.value }))}
                placeholder="Holiday hat"
              />
            </label>
          ) : null}
          {fields.background !== null && !usesRosterVariantField('background', catalogs) ? (
            <label className="field">
              <span>Background</span>
              <input
                value={fields.background}
                onChange={(e) => setFields((f) => ({ ...f, background: e.target.value }))}
                placeholder="Tokyo"
              />
            </label>
          ) : null}
          <label className={styles.checkRow}>
            <span className={styles.checkCopy}>
              <span aria-hidden="true">⬛</span>
              Silhouette
            </span>
            <input
              type="checkbox"
              checked={Boolean(fields.silhouette)}
              onChange={(e) => setFields((f) => ({ ...f, silhouette: e.target.checked }))}
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
              onChange={(e) => setHeightDraft(e.target.value)}
              onBlur={() => setHeightDraft(String(cropBottom))}
            />
          </label>
          <p className="page-sub">
            Follows the tallest selected tag. Changing this number crops this screenshot only.
          </p>
        </>
      )}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : saveLabel}
      </button>
    </BottomSheet>
  )
}

export function SpecimenTagSheet({
  specimen,
  onClose,
  onSaved,
}: {
  specimen: SpecimenRow | null
  onClose: () => void
  onSaved: (specimen: SpecimenRow) => void
}) {
  const { showToast } = useToast()
  return (
    <TagSheet
      open={Boolean(specimen)}
      title="Edit tags"
      resetKey={specimen?.id ?? ''}
      imageId={specimen?.imageId}
      initialFields={specimen ?? undefined}
      saveLabel="Save tags"
      tone="living"
      nested
      onClose={onClose}
      onSave={async (fields, cropBottom) => {
        if (!specimen) return
        const result = await updateSpecimen(specimen.id, fields, cropBottom)
        if (result.duplicate) showToast('Same look already in the collection', 'warning')
        if (result.cloudError) showToast(result.cloudError, 'warning')
        else if (!result.duplicate) showToast('Tags saved', 'success')
        onSaved(result.specimen)
      }}
      onWarning={(message) => showToast(message, 'warning')}
      onError={(message) => showToast(message)}
    />
  )
}

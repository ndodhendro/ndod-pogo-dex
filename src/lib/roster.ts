import { SPECIES, SPECIES_BY_ID, searchSpecies } from '../data/species'
import {
  extraTagList,
  hasAllRequired,
  isFormTag,
  isSilhouette,
  labelForTag,
  specimenTags,
  type SpecimenFields,
  type TagId,
} from './tags'

export type SlotMode = 'species' | 'variant'

export type TagCatalog = {
  tag: TagId
  limitPokedex: boolean
  slotMode: SlotMode
}

export type TagRosterEntry = {
  tag: TagId
  speciesId: number
  variant: string
}

export type DexSlotDef = {
  speciesId: number
  variant: string
  name: string
}

export const SPECIES_SLOT_VARIANT = ''

const VARIANT_TAGS = new Set<string>(['costume', 'background', 'alternate-forme'])

export function defaultSlotMode(tag: TagId): SlotMode {
  return VARIANT_TAGS.has(tag) ? 'variant' : 'species'
}

export function catalogForTag(catalogs: readonly TagCatalog[], tag: TagId): TagCatalog {
  const row = catalogs.find((item) => item.tag === tag)
  return row ?? { tag, limitPokedex: false, slotMode: defaultSlotMode(tag) }
}

export function normalizeVariant(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function variantsMatch(a: string | null | undefined, b: string | null | undefined) {
  return normalizeVariant(a).toLowerCase() === normalizeVariant(b).toLowerCase()
}

export function slotId(speciesId: number, variant: string) {
  return `${speciesId}:${normalizeVariant(variant).toLowerCase()}`
}

export function slotDisplayName(speciesId: number, variant: string) {
  const species = SPECIES_BY_ID.get(speciesId)?.name ?? `#${String(speciesId).padStart(4, '0')}`
  const label = normalizeVariant(variant)
  return label ? `${species} ${label}` : species
}

export function slotBoxLabel(slot: Pick<DexSlotDef, 'speciesId' | 'variant' | 'name'>) {
  const number = `#${String(slot.speciesId).padStart(4, '0')}`
  return `${number} ${slot.name}`
}

export function nationalDexSlots(): DexSlotDef[] {
  return SPECIES.map((species) => ({
    speciesId: species.id,
    variant: SPECIES_SLOT_VARIANT,
    name: species.name,
  }))
}

export function variantValueForTag(fields: SpecimenFields, tag: TagId): string {
  if (tag === 'costume') return normalizeVariant(fields.costume)
  if (tag === 'background') return normalizeVariant(fields.background)
  if (tag === 'alternate-forme' || isFormTag(tag)) return normalizeVariant(fields.form)
  return SPECIES_SLOT_VARIANT
}

export function primaryVariantTag(
  tags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): TagId | null {
  for (const tag of tags) {
    const catalog = catalogForTag(catalogs, tag)
    if (catalog.limitPokedex && catalog.slotMode === 'variant') return tag
  }
  return null
}

export function slotVariantForTrack(
  fields: SpecimenFields,
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): string {
  const tag = primaryVariantTag(requiredTags, catalogs)
  return tag ? variantValueForTag(fields, tag) : SPECIES_SLOT_VARIANT
}

export function releasedEntriesForTag(
  roster: readonly TagRosterEntry[],
  tag: TagId,
): TagRosterEntry[] {
  return roster.filter((row) => row.tag === tag)
}

function releasedSpeciesIds(roster: readonly TagRosterEntry[], tag: TagId): Set<number> {
  const ids = new Set<number>()
  for (const row of releasedEntriesForTag(roster, tag)) {
    if (normalizeVariant(row.variant) === SPECIES_SLOT_VARIANT) ids.add(row.speciesId)
  }
  return ids
}

function releasedVariantSlots(roster: readonly TagRosterEntry[], tag: TagId): DexSlotDef[] {
  return releasedEntriesForTag(roster, tag)
    .filter((row) => normalizeVariant(row.variant) !== SPECIES_SLOT_VARIANT)
    .map((row) => ({
      speciesId: row.speciesId,
      variant: normalizeVariant(row.variant),
      name: slotDisplayName(row.speciesId, row.variant),
    }))
    .sort((a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant))
}

function intersectIds(current: Set<number> | null, next: Set<number>): Set<number> {
  if (!current) return next
  const out = new Set<number>()
  for (const id of current) {
    if (next.has(id)) out.add(id)
  }
  return out
}

export function trackIsLimited(requiredTags: readonly TagId[], catalogs: readonly TagCatalog[]) {
  return requiredTags.some((tag) => catalogForTag(catalogs, tag).limitPokedex)
}

export function slotsForTrack(
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  if (requiredTags.length === 0) return nationalDexSlots()
  const limited = requiredTags.filter((tag) => catalogForTag(catalogs, tag).limitPokedex)
  if (limited.length === 0) return nationalDexSlots()

  const speciesTags = limited.filter((tag) => catalogForTag(catalogs, tag).slotMode !== 'variant')
  const variantTags = limited.filter((tag) => catalogForTag(catalogs, tag).slotMode === 'variant')

  let speciesIds: Set<number> | null = null
  for (const tag of speciesTags) {
    speciesIds = intersectIds(speciesIds, releasedSpeciesIds(roster, tag))
  }

  if (variantTags.length === 0) {
    const ids = [...(speciesIds ?? new Set<number>())].sort((a, b) => a - b)
    return ids.map((speciesId) => ({
      speciesId,
      variant: SPECIES_SLOT_VARIANT,
      name: slotDisplayName(speciesId, SPECIES_SLOT_VARIANT),
    }))
  }

  let slots = releasedVariantSlots(roster, variantTags[0])
  for (const tag of variantTags.slice(1)) {
    const allowed = new Set(
      releasedVariantSlots(roster, tag).map((slot) => slotId(slot.speciesId, slot.variant)),
    )
    slots = slots.filter((slot) => allowed.has(slotId(slot.speciesId, slot.variant)))
  }
  if (speciesIds) slots = slots.filter((slot) => speciesIds.has(slot.speciesId))
  return slots
}

export function slotsForSelectedTags(
  tags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  const limited = tags.filter((tag) => catalogForTag(catalogs, tag).limitPokedex)
  if (limited.length === 0) return nationalDexSlots()
  return slotsForTrack(limited, catalogs, roster)
}

export function searchSlots(slots: readonly DexSlotDef[], query: string): DexSlotDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...slots]
  return slots.filter((slot) => {
    const id = String(slot.speciesId)
    const padded = id.padStart(4, '0')
    return (
      slot.name.toLowerCase().includes(q) ||
      id === q ||
      padded === q.padStart(4, '0') ||
      padded === q ||
      normalizeVariant(slot.variant).toLowerCase().includes(q)
    )
  })
}

export function searchSpeciesOptions(query: string) {
  return searchSpecies(query)
}

export function specimenFillsSlot(
  fields: SpecimenFields,
  requiredTags: readonly TagId[],
  slot: DexSlotDef,
  catalogs: readonly TagCatalog[],
): boolean {
  if (fields.speciesId !== slot.speciesId) return false
  if (!hasAllRequired(specimenTags(fields), [...requiredTags])) return false
  if (slot.variant === SPECIES_SLOT_VARIANT && !primaryVariantTag(requiredTags, catalogs)) return true
  return variantsMatch(slotVariantForTrack(fields, requiredTags, catalogs), slot.variant)
}

export function countFilledSlots(
  specimens: readonly SpecimenFields[],
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): { filled: number; total: number } {
  const slots = slotsForTrack(requiredTags, catalogs, roster)
  const total = slots.length
  if (total === 0) return { filled: 0, total: 0 }
  if (!trackIsLimited(requiredTags, catalogs)) {
    const filled = new Set<number>()
    const required = [...requiredTags]
    for (const specimen of specimens) {
      if (isSilhouette(specimen) || filled.has(specimen.speciesId)) continue
      if (hasAllRequired(specimenTags(specimen), required)) filled.add(specimen.speciesId)
    }
    return { filled: filled.size, total }
  }
  const allowed = new Set(slots.map((slot) => slotId(slot.speciesId, slot.variant)))
  const filled = new Set<string>()
  for (const specimen of specimens) {
    if (isSilhouette(specimen)) continue
    if (!hasAllRequired(specimenTags(specimen), [...requiredTags])) continue
    const variant = slotVariantForTrack(specimen, requiredTags, catalogs)
    const key = slotId(specimen.speciesId, variant)
    if (allowed.has(key)) filled.add(key)
  }
  return { filled: filled.size, total }
}

export function rosterHasSlot(
  roster: readonly TagRosterEntry[],
  tag: TagId,
  speciesId: number,
  variant: string,
) {
  const wanted = slotId(speciesId, variant)
  return roster.some((row) => row.tag === tag && slotId(row.speciesId, row.variant) === wanted)
}

export function fieldsAllowedOnLimitedTags(
  fields: SpecimenFields,
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): TagId | null {
  const tags = specimenTags(fields)
  for (const tag of tags) {
    const catalog = catalogForTag(catalogs, tag)
    if (!catalog.limitPokedex) continue
    const variant =
      catalog.slotMode === 'variant' ? variantValueForTag(fields, tag) : SPECIES_SLOT_VARIANT
    if (catalog.slotMode === 'variant' && !variant) continue
    if (!rosterHasSlot(roster, tag, fields.speciesId, variant)) return tag
  }
  return null
}

export function limitedRosterWarning(
  fields: SpecimenFields,
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
  tagLabel: (tag: TagId) => string = labelForTag,
): string {
  if (!fields.speciesId) return ''
  const blocked = fieldsAllowedOnLimitedTags(fields, catalogs, roster)
  if (!blocked) return ''
  return `Not in the ${tagLabel(blocked)} Pokédex`
}

export function canEnableLimitedTag(
  fields: SpecimenFields,
  tag: TagId,
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): boolean {
  if (!fields.speciesId) return true
  const catalog = catalogForTag(catalogs, tag)
  if (!catalog.limitPokedex) return true
  const variant =
    catalog.slotMode === 'variant' ? variantValueForTag(fields, tag) : SPECIES_SLOT_VARIANT
  if (catalog.slotMode === 'variant' && !variant) return true
  return rosterHasSlot(roster, tag, fields.speciesId, variant)
}

export function applyRosterSlot(
  fields: SpecimenFields,
  slot: DexSlotDef,
  selectedTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): SpecimenFields {
  const next: SpecimenFields = { ...fields, speciesId: slot.speciesId }
  const tag = primaryVariantTag(selectedTags, catalogs)
  if (!tag || !normalizeVariant(slot.variant)) return next
  if (tag === 'costume') return { ...next, costume: normalizeVariant(slot.variant) }
  if (tag === 'background') return { ...next, background: normalizeVariant(slot.variant) }
  if (tag === 'alternate-forme' || isFormTag(tag)) {
    const extra = extraTagList(next)
    return {
      ...next,
      form: normalizeVariant(slot.variant),
      extraTags: extra.includes(tag) ? extra : [...extra, tag],
    }
  }
  return next
}

export function usesRosterVariantField(
  tag: TagId,
  catalogs: readonly TagCatalog[],
): boolean {
  const catalog = catalogForTag(catalogs, tag)
  return catalog.limitPokedex && catalog.slotMode === 'variant'
}

export function rosterEntryKey(tag: TagId, speciesId: number, variant: string) {
  return [tag, speciesId, normalizeVariant(variant)] as const
}

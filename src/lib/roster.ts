import {
  GO_ALTERNATE_FORME,
  GO_BACKGROUND,
  GO_COSTUME,
  GO_GENDER,
  GO_MEGA,
  basicDefaultForme,
  goFormSpeciesIds,
  hasStaticFormList,
  isGoFormReleased,
  staticFormSlotCount,
} from '../data/goFormReleased'
import { GO_RELEASED_IDS, isGoReleased } from '../data/goReleased'
import { SPECIES, SPECIES_BY_ID, searchSpecies } from '../data/species'
import { BASIC_CROP_TAG } from '../data/tagCrops'
import { isGreenCover } from './covers'
import {
  extraTagList,
  formNameForTag,
  hasAllRequired,
  isFormTag,
  isSilhouette,
  labelForTag,
  specimenTags,
  type SpecimenFields,
  type TagId,
} from './tags'

/** Empty-look Basic track stores its roster under this catalog key. Not a specimen tag. */
export const BASIC_DEX_TAG: TagId = BASIC_CROP_TAG

/** These tracks always use the Basic species list, not a separate roster. */
export const FOLLOW_BASIC_TAGS = new Set<TagId>([
  'best-buddy',
  'xxl',
  'xxs',
  'hundo',
  'nundo',
  'max-cp',
])

export function tagFollowsBasicList(tag: TagId): boolean {
  return FOLLOW_BASIC_TAGS.has(tag)
}

export function defaultLimitPokedex(tag: TagId): boolean {
  return !tagFollowsBasicList(tag)
}

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

export type SlotVariantPart = {
  tag: TagId
  variant: string
}

export type DexSlotDef = {
  speciesId: number
  variant: string
  name: string
  /** Present when several variant tracks are combined (Mega Male, Mega X Female). */
  variantParts?: readonly SlotVariantPart[]
}

export const SPECIES_SLOT_VARIANT = ''

const VARIANT_TAGS = new Set<string>(['costume', 'background', 'alternate-forme', 'gender', 'mega'])
const SPECIES_ONLY_TAGS = new Set<string>([
  'alolan',
  'galarian',
  'hisuian',
  'paldean',
  'gigantamax',
  'shiny',
  'dynamax',
  'shadow',
  'purified',
  'lucky',
])
const VARIANT_ONLY_TAGS = new Set<string>(['gender', 'mega', 'costume', 'background'])
/** Form, then gender, then costume/background so combo labels read like Venusaur Mega Male. */
const VARIANT_COMBINE_RANK: Record<string, number> = {
  'alternate-forme': 0,
  mega: 1,
  gender: 2,
  costume: 3,
  background: 4,
}

export function defaultSlotMode(tag: TagId): SlotMode {
  if (SPECIES_ONLY_TAGS.has(tag)) return 'species'
  if (VARIANT_ONLY_TAGS.has(tag) || VARIANT_TAGS.has(tag)) return 'variant'
  return 'species'
}

export function slotModeLockedToSpecies(tag: TagId): boolean {
  return SPECIES_ONLY_TAGS.has(tag)
}

export function slotModeLockedToVariant(tag: TagId): boolean {
  return VARIANT_ONLY_TAGS.has(tag)
}

export function isOwnListTag(tag: TagId): boolean {
  return tag !== BASIC_DEX_TAG && !tagFollowsBasicList(tag)
}

export function catalogForTag(catalogs: readonly TagCatalog[], tag: TagId): TagCatalog {
  const row = catalogs.find((item) => item.tag === tag)
  const slotMode = slotModeLockedToSpecies(tag)
    ? 'species'
    : slotModeLockedToVariant(tag)
      ? 'variant'
      : (row?.slotMode ?? defaultSlotMode(tag))
  const limitPokedex = isOwnListTag(tag)
    ? true
    : (row?.limitPokedex ?? defaultLimitPokedex(tag))
  return { tag, limitPokedex, slotMode }
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
  const label = normalizeVariant(variant) || basicDefaultForme(speciesId)
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
    name: slotDisplayName(species.id, SPECIES_SLOT_VARIANT),
  }))
}

export function variantValueForTag(fields: SpecimenFields, tag: TagId): string {
  if (tag === 'costume') return normalizeVariant(fields.costume)
  if (tag === 'background') return normalizeVariant(fields.background)
  if (tag === 'gender') return normalizeVariant(fields.gender)
  if (tag === 'alternate-forme' || isFormTag(tag)) return normalizeVariant(fields.form)
  return SPECIES_SLOT_VARIANT
}

export function primaryVariantTag(
  tags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): TagId | null {
  const ranked = variantTagsOnTrack(tags, catalogs)
  return ranked[0] ?? null
}

function sortVariantTags(tags: readonly TagId[]): TagId[] {
  return [...tags].sort((a, b) => {
    const rankA = VARIANT_COMBINE_RANK[a] ?? 50
    const rankB = VARIANT_COMBINE_RANK[b] ?? 50
    if (rankA !== rankB) return rankA - rankB
    return a.localeCompare(b)
  })
}

function variantTagsOnTrack(tags: readonly TagId[], catalogs: readonly TagCatalog[]): TagId[] {
  return sortVariantTags(
    tags.filter((tag) => {
      if (tagFollowsBasicList(tag) || tag === BASIC_DEX_TAG) return false
      return catalogForTag(catalogs, tag).slotMode === 'variant'
    }),
  )
}

function joinVariantParts(parts: readonly SlotVariantPart[]): string {
  return parts
    .map((part) => normalizeVariant(part.variant))
    .filter(Boolean)
    .join(' ')
}

export function slotVariantForTrack(
  fields: SpecimenFields,
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): string {
  const tags = variantTagsOnTrack(requiredTags, catalogs)
  if (tags.length === 0) return SPECIES_SLOT_VARIANT
  if (tags.length === 1) return variantValueForTag(fields, tags[0])
  return joinVariantParts(tags.map((tag) => ({ tag, variant: variantValueForTag(fields, tag) })))
}

export function releasedEntriesForTag(
  roster: readonly TagRosterEntry[],
  tag: TagId,
): TagRosterEntry[] {
  return roster.filter((row) => row.tag === tag)
}

export function tagUsesStaticReleasedList(tag: TagId): boolean {
  return tag === BASIC_DEX_TAG || hasStaticFormList(tag)
}

export function staticReleasedCount(tag: TagId, slotMode: SlotMode): number {
  if (tag === BASIC_DEX_TAG) return GO_RELEASED_IDS.size
  return staticFormSlotCount(tag, slotMode === 'variant')
}

export function slotIsStaticReleased(tag: TagId, speciesId: number, variant: string): boolean {
  const v = normalizeVariant(variant)
  if (tag === BASIC_DEX_TAG) return v === SPECIES_SLOT_VARIANT && isGoReleased(speciesId)
  if (isGoFormReleased(tag, speciesId, v)) return true
  if (tag === 'mega' || tag === 'gender' || tag === 'alternate-forme' || tag === 'costume' || tag === 'background')
    return false
  const formIds = goFormSpeciesIds(tag)
  const formName = formNameForTag(tag)
  return Boolean(formIds && formName && formIds.has(speciesId) && variantsMatch(v, formName))
}

function releasedSpeciesIds(roster: readonly TagRosterEntry[], tag: TagId): Set<number> {
  const ids = new Set<number>()
  for (const row of releasedEntriesForTag(roster, tag)) {
    if (normalizeVariant(row.variant) === SPECIES_SLOT_VARIANT) ids.add(row.speciesId)
  }
  if (tag === BASIC_DEX_TAG) {
    for (const id of GO_RELEASED_IDS) ids.add(id)
  }
  const formIds = goFormSpeciesIds(tag)
  if (formIds) {
    for (const id of formIds) ids.add(id)
  }
  if (tag === 'alternate-forme') {
    for (const row of GO_ALTERNATE_FORME) ids.add(row.speciesId)
  }
  if (tag === 'gender') {
    for (const row of GO_GENDER) ids.add(row.speciesId)
  }
  if (tag === 'mega') {
    for (const row of GO_MEGA) ids.add(row.speciesId)
  }
  if (tag === 'costume') {
    for (const row of GO_COSTUME) ids.add(row.speciesId)
  }
  if (tag === 'background') {
    for (const row of GO_BACKGROUND) ids.add(row.speciesId)
  }
  return ids
}

function limitedSpeciesAllowed(
  roster: readonly TagRosterEntry[],
  tag: TagId,
  speciesId: number,
  variant: string,
) {
  if (rosterHasSlot(roster, tag, speciesId, variant)) return true
  return slotIsStaticReleased(tag, speciesId, variant)
}

function releasedVariantSlots(roster: readonly TagRosterEntry[], tag: TagId): DexSlotDef[] {
  const slots: DexSlotDef[] = []
  const seen = new Set<string>()

  function add(speciesId: number, variant: string) {
    const label = normalizeVariant(variant)
    if (!label) return
    const key = slotId(speciesId, label)
    if (seen.has(key)) return
    seen.add(key)
    slots.push({
      speciesId,
      variant: label,
      name: slotDisplayName(speciesId, label),
    })
  }

  for (const row of releasedEntriesForTag(roster, tag)) add(row.speciesId, row.variant)
  const formIds = goFormSpeciesIds(tag)
  const formName = formNameForTag(tag)
  if (formIds && formName && tag !== 'mega') {
    for (const speciesId of formIds) add(speciesId, formName)
  }
  if (tag === 'alternate-forme') {
    for (const row of GO_ALTERNATE_FORME) add(row.speciesId, row.variant)
  }
  if (tag === 'gender') {
    for (const row of GO_GENDER) add(row.speciesId, row.variant)
  }
  if (tag === 'mega') {
    for (const row of GO_MEGA) add(row.speciesId, row.variant)
  }
  if (tag === 'costume') {
    for (const row of GO_COSTUME) add(row.speciesId, row.variant)
  }
  if (tag === 'background') {
    for (const row of GO_BACKGROUND) add(row.speciesId, row.variant)
  }

  return slots.sort((a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant))
}

function intersectIds(current: Set<number> | null, next: Set<number>): Set<number> {
  if (!current) return next
  const out = new Set<number>()
  for (const id of current) {
    if (next.has(id)) out.add(id)
  }
  return out
}

export function catalogTagsForTrack(requiredTags: readonly TagId[]): TagId[] {
  return requiredTags.length === 0 ? [BASIC_DEX_TAG] : [...requiredTags]
}

export function usesBasicSpeciesList(requiredTags: readonly TagId[]): boolean {
  return catalogTagsForTrack(requiredTags).every(
    (tag) => tag === BASIC_DEX_TAG || tagFollowsBasicList(tag),
  )
}

function ownListTags(requiredTags: readonly TagId[]): TagId[] {
  return catalogTagsForTrack(requiredTags).filter((tag) => !tagFollowsBasicList(tag))
}

function speciesSlotsFromIds(ids: Iterable<number>): DexSlotDef[] {
  return [...ids]
    .sort((a, b) => a - b)
    .map((speciesId) => ({
      speciesId,
      variant: SPECIES_SLOT_VARIANT,
      name: slotDisplayName(speciesId, SPECIES_SLOT_VARIANT),
    }))
}

function ensureVariantParts(slot: DexSlotDef, tag: TagId): DexSlotDef {
  if (slot.variantParts?.length) return slot
  return { ...slot, variantParts: [{ tag, variant: normalizeVariant(slot.variant) }] }
}

function cartesianVariantSlots(
  left: DexSlotDef[],
  leftTag: TagId,
  right: DexSlotDef[],
  rightTag: TagId,
): DexSlotDef[] {
  const bySpecies = new Map<number, DexSlotDef[]>()
  for (const slot of right) {
    const list = bySpecies.get(slot.speciesId) ?? []
    list.push(ensureVariantParts(slot, rightTag))
    bySpecies.set(slot.speciesId, list)
  }
  const out: DexSlotDef[] = []
  const seen = new Set<string>()
  for (const raw of left) {
    const a = ensureVariantParts(raw, leftTag)
    for (const b of bySpecies.get(a.speciesId) ?? []) {
      const parts = [...(a.variantParts ?? []), ...(b.variantParts ?? [])]
      const variant = joinVariantParts(parts)
      if (!variant) continue
      const key = slotId(a.speciesId, variant)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        speciesId: a.speciesId,
        variant,
        name: slotDisplayName(a.speciesId, variant),
        variantParts: parts,
      })
    }
  }
  return out
}

function slotsForLimitedTags(
  limited: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  const speciesTags = limited.filter((tag) => catalogForTag(catalogs, tag).slotMode !== 'variant')
  const variantTags = sortVariantTags(
    limited.filter((tag) => catalogForTag(catalogs, tag).slotMode === 'variant'),
  )

  let speciesIds: Set<number> | null = null
  for (const tag of speciesTags) {
    speciesIds = intersectIds(speciesIds, releasedSpeciesIds(roster, tag))
  }

  if (variantTags.length === 0) {
    return speciesSlotsFromIds(speciesIds ?? new Set<number>())
  }

  let slots = releasedVariantSlots(roster, variantTags[0])
  for (const tag of variantTags.slice(1)) {
    slots = cartesianVariantSlots(slots, variantTags[0], releasedVariantSlots(roster, tag), tag)
  }
  if (speciesIds) slots = slots.filter((slot) => speciesIds.has(slot.speciesId))
  return slots.sort((a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant))
}

function basicSpeciesSlots(
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  const basic = catalogForTag(catalogs, BASIC_DEX_TAG)
  if (!basic.limitPokedex) return nationalDexSlots()
  return slotsForLimitedTags([BASIC_DEX_TAG], catalogs, roster)
}

export function trackIsLimited(requiredTags: readonly TagId[], catalogs: readonly TagCatalog[]) {
  if (usesBasicSpeciesList(requiredTags)) {
    return catalogForTag(catalogs, BASIC_DEX_TAG).limitPokedex
  }
  return true
}

export function isRosterNamedVariantTag(tag: TagId): boolean {
  return tag === 'costume'
}

export function slotsForTrack(
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  if (usesBasicSpeciesList(requiredTags)) return basicSpeciesSlots(catalogs, roster)
  return slotsForLimitedTags(ownListTags(requiredTags), catalogs, roster)
}

export function slotsForSelectedTags(
  tags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): DexSlotDef[] {
  const named = tags.filter(isRosterNamedVariantTag)
  const rest = tags.filter((tag) => !isRosterNamedVariantTag(tag))
  if (named.length > 0 && variantTagsOnTrack(rest, catalogs).length > 0) {
    return slotsForTrack(rest, catalogs, roster)
  }
  return slotsForTrack(tags, catalogs, roster)
}

/** Costume/background come from the species slot only when that slot encodes them. */
export function variantFieldComesFromSlot(
  tag: TagId,
  selectedTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  slots: readonly DexSlotDef[],
): boolean {
  if (!usesRosterVariantField(tag, catalogs)) return false
  if (slots.some((slot) => slot.variantParts?.some((part) => part.tag === tag))) return true
  const variantTags = variantTagsOnTrack(selectedTags, catalogs)
  return variantTags.length === 1 && variantTags[0] === tag
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

export function countReleasedSlots(
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
): number {
  return slotsForTrack(requiredTags, catalogs, roster).length
}

export type SlotProgress = {
  seen: number
  caught: number
  pure: number
  /** Caught count; kept for existing callers. */
  filled: number
  total: number
}

function slotProgress(seen: number, caught: number, pure: number, total: number): SlotProgress {
  return { seen, caught, pure, filled: caught, total }
}

export function countFilledSlots(
  specimens: readonly SpecimenFields[],
  requiredTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
  roster: readonly TagRosterEntry[],
  speciesRange?: { start: number; end: number },
): SlotProgress {
  const inRange = (speciesId: number) =>
    !speciesRange || (speciesId >= speciesRange.start && speciesId <= speciesRange.end)
  const slots = slotsForTrack(requiredTags, catalogs, roster).filter((slot) => inRange(slot.speciesId))
  const total = slots.length
  if (total === 0) return slotProgress(0, 0, 0, 0)
  const required = [...requiredTags]
  const seen = new Set<string>()
  const caught = new Set<string>()
  const pure = new Set<string>()
  const limited = trackIsLimited(requiredTags, catalogs)
  const allowed = limited ? new Set(slots.map((slot) => slotId(slot.speciesId, slot.variant))) : null

  for (const specimen of specimens) {
    if (!inRange(specimen.speciesId)) continue
    const tags = specimenTags(specimen)
    if (!hasAllRequired(tags, required)) continue
    const key = limited
      ? slotId(specimen.speciesId, slotVariantForTrack(specimen, requiredTags, catalogs))
      : String(specimen.speciesId)
    if (allowed && !allowed.has(key)) continue
    seen.add(key)
    if (isSilhouette(specimen)) continue
    caught.add(key)
    if (isGreenCover(tags, required, false, specimen.speciesId, specimen.gender)) pure.add(key)
  }
  return slotProgress(seen.size, caught.size, pure.size, total)
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
  const check: TagId[] = []
  if (tags.length === 0 || tags.includes(BASIC_DEX_TAG) || tags.some(tagFollowsBasicList)) {
    check.push(BASIC_DEX_TAG)
  }
  for (const tag of tags) {
    if (!tagFollowsBasicList(tag)) check.push(tag)
  }
  for (const tag of check) {
    const catalog = catalogForTag(catalogs, tag)
    if (!catalog.limitPokedex) continue
    const variant =
      catalog.slotMode === 'variant' ? variantValueForTag(fields, tag) : SPECIES_SLOT_VARIANT
    if (catalog.slotMode === 'variant' && !variant) continue
    if (!limitedSpeciesAllowed(roster, tag, fields.speciesId, variant)) return tag
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
  if (tagFollowsBasicList(tag) || tag === BASIC_DEX_TAG) {
    const basic = catalogForTag(catalogs, BASIC_DEX_TAG)
    if (!basic.limitPokedex) return true
    return limitedSpeciesAllowed(roster, BASIC_DEX_TAG, fields.speciesId, SPECIES_SLOT_VARIANT)
  }
  const catalog = catalogForTag(catalogs, tag)
  if (!catalog.limitPokedex) return true
  const variant =
    catalog.slotMode === 'variant' ? variantValueForTag(fields, tag) : SPECIES_SLOT_VARIANT
  if (catalog.slotMode === 'variant' && !variant) return true
  return limitedSpeciesAllowed(roster, tag, fields.speciesId, variant)
}

function applyVariantField(fields: SpecimenFields, tag: TagId, variant: string): SpecimenFields {
  const value = normalizeVariant(variant)
  if (!value) return fields
  if (tag === 'costume') return { ...fields, costume: value }
  if (tag === 'background') return { ...fields, background: value }
  if (tag === 'gender') {
    const extra = extraTagList(fields)
    return {
      ...fields,
      gender: value,
      extraTags: extra.includes('gender') ? extra : [...extra, 'gender'],
    }
  }
  if (tag === 'alternate-forme' || isFormTag(tag)) {
    const extra = extraTagList(fields)
    return {
      ...fields,
      form: value,
      extraTags: extra.includes(tag) ? extra : [...extra, tag],
    }
  }
  return fields
}

export function applyRosterSlot(
  fields: SpecimenFields,
  slot: DexSlotDef,
  selectedTags: readonly TagId[],
  catalogs: readonly TagCatalog[],
): SpecimenFields {
  let next: SpecimenFields = { ...fields, speciesId: slot.speciesId }
  const tag = primaryVariantTag(selectedTags, catalogs)
  const parts = slot.variantParts?.length
    ? slot.variantParts
    : tag && normalizeVariant(slot.variant)
      ? [{ tag, variant: slot.variant }]
      : []
  for (const part of parts) {
    next = applyVariantField(next, part.tag, part.variant)
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

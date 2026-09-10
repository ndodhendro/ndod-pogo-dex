export const TAG_IDS = [
  'shiny',
  'shadow',
  'purified',
  'costume',
  'background',
  'hundo',
  'nundo',
] as const

export type BuiltInTagId = (typeof TAG_IDS)[number]
export type TagId = BuiltInTagId | (string & {})
export type ShadowStatus = 'none' | 'shadow' | 'purified' | 'both'

export function hasShadowStatus(status: ShadowStatus): boolean {
  return status === 'shadow' || status === 'both'
}

export function hasPurifiedStatus(status: ShadowStatus): boolean {
  return status === 'purified' || status === 'both'
}

function combineShadowStatus(shadow: boolean, purified: boolean): ShadowStatus {
  if (shadow && purified) return 'both'
  if (shadow) return 'shadow'
  if (purified) return 'purified'
  return 'none'
}

const BUILTIN_TAGS = new Set<string>(TAG_IDS)

export function isBuiltInTag(tag: string): tag is BuiltInTagId {
  return BUILTIN_TAGS.has(tag)
}

export type SpecimenFields = {
  speciesId: number
  form: string | null
  shiny: boolean
  shadowStatus: ShadowStatus
  costume: string | null
  background: string | null
  /** Male / Female / Hisuian Male, etc. Null when the Gender tag is off. */
  gender?: string | null
  hundo: boolean
  nundo: boolean
  extraTags?: TagId[]
  /** Seen in the wild, not caught. Not a tag; never counts as a pure cover. */
  silhouette?: boolean
}

export const TAG_LABELS: Record<BuiltInTagId, string> = {
  shiny: 'Shiny',
  shadow: 'Shadow',
  purified: 'Purified',
  costume: 'Costume',
  background: 'Background',
  hundo: 'Hundo',
  nundo: 'Nundo',
}

import { BASIC_CROP_TAG, EXTRA_TAG_LABELS } from '../data/tagCrops'

export function labelForTag(tag: TagId): string {
  if (isBuiltInTag(tag)) return TAG_LABELS[tag]
  if (tag === 'basic') return 'Basic'
  return formNameForTag(tag) ?? EXTRA_TAG_LABELS[tag] ?? tag
}

export function extraTagList(s: { extraTags?: TagId[] }): TagId[] {
  const seen = new Set<TagId>()
  const tags: TagId[] = []
  for (const tag of s.extraTags ?? []) {
    if (!tag || isBuiltInTag(tag) || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

export function isSilhouette(s: { silhouette?: boolean } | null | undefined): boolean {
  return s?.silhouette === true
}

export function fieldsFromSpecimen(row: SpecimenFields): SpecimenFields {
  return {
    speciesId: row.speciesId,
    form: row.form,
    shiny: row.shiny,
    shadowStatus: row.shadowStatus,
    costume: row.costume,
    background: row.background,
    gender: row.gender ?? null,
    hundo: row.hundo,
    nundo: row.nundo,
    extraTags: extraTagList(row),
    silhouette: isSilhouette(row),
  }
}

export const FORM_TAGS = ['alolan', 'galarian', 'hisuian', 'paldean', 'mega'] as const
export type FormTagId = (typeof FORM_TAGS)[number]

const FORM_BY_TAG: Record<FormTagId, string> = {
  alolan: 'Alolan',
  galarian: 'Galarian',
  hisuian: 'Hisuian',
  paldean: 'Paldean',
  mega: 'Mega',
}

export function formNameForTag(tag: string): string | undefined {
  return FORM_BY_TAG[tag.toLowerCase() as FormTagId]
}

export function isFormTag(tag: string): tag is FormTagId {
  return Boolean(formNameForTag(tag))
}

function formLabelFromExtra(extra: TagId[]): string | null {
  const names = FORM_TAGS.filter((tag) => extra.includes(tag)).map((tag) => FORM_BY_TAG[tag])
  return names.length ? names.join(' · ') : null
}

export function clearVisualTags(fields: SpecimenFields): SpecimenFields {
  return {
    speciesId: fields.speciesId,
    form: null,
    shiny: false,
    shadowStatus: 'none',
    costume: null,
    background: null,
    gender: null,
    hundo: false,
    nundo: false,
    extraTags: [],
    silhouette: isSilhouette(fields),
  }
}

function dropBasicTag(fields: SpecimenFields): SpecimenFields {
  const extra = extraTagList(fields).filter((tag) => tag !== BASIC_CROP_TAG)
  return extra.length === extraTagList(fields).length ? fields : { ...fields, extraTags: extra }
}

function toggleBasicTag(fields: SpecimenFields): SpecimenFields {
  const extra = extraTagList(fields)
  if (extra.includes(BASIC_CROP_TAG)) {
    return { ...fields, extraTags: extra.filter((tag) => tag !== BASIC_CROP_TAG) }
  }
  const keepGender = extra.includes('gender')
  return {
    ...clearVisualTags(fields),
    gender: keepGender ? (fields.gender ?? '') : null,
    extraTags: keepGender ? [BASIC_CROP_TAG, 'gender'] : [BASIC_CROP_TAG],
  }
}

export function specimenTags(s: SpecimenFields): TagId[] {
  const tags: TagId[] = []
  if (s.shiny) tags.push('shiny')
  if (hasShadowStatus(s.shadowStatus)) tags.push('shadow')
  if (hasPurifiedStatus(s.shadowStatus)) tags.push('purified')
  if (s.costume !== null) tags.push('costume')
  if (s.background !== null) tags.push('background')
  if (s.hundo) tags.push('hundo')
  if (s.nundo) tags.push('nundo')
  tags.push(...extraTagList(s))
  return tags
}

export function visualKey(s: SpecimenFields): string {
  return [
    s.speciesId,
    s.form ?? '',
    s.shiny ? '1' : '0',
    (s.costume ?? '').trim().toLowerCase(),
    s.shadowStatus,
    (s.background ?? '').trim().toLowerCase(),
    (s.gender ?? '').trim().toLowerCase(),
    extraTagList(s).slice().sort().join(','),
    isSilhouette(s) ? 'sil' : '',
  ].join('|')
}

export function toggleRequiredTags(picked: TagId[], tags: TagId[]): TagId[] {
  if (tags.length === 0) return picked
  const selected = tags.every((tag) => picked.includes(tag))
  if (selected) return picked.filter((tag) => !tags.includes(tag))
  return [...new Set([...picked, ...tags])]
}

export function hasAllRequired(tags: TagId[], required: TagId[]): boolean {
  return required.every((tag) => tags.includes(tag))
}

export function isExactMatch(tags: TagId[], required: TagId[]): boolean {
  if (tags.length !== required.length) return false
  const set = new Set(tags)
  return required.every((tag) => set.has(tag))
}

export function toggleTag(fields: SpecimenFields, tag: TagId): SpecimenFields {
  if (tag === BASIC_CROP_TAG) return toggleBasicTag(fields)
  const next = { ...fields }
  if (tag === 'shiny') next.shiny = !next.shiny
  if (tag === 'hundo') next.hundo = !next.hundo
  if (tag === 'nundo') next.nundo = !next.nundo
  if (tag === 'shadow') {
    next.shadowStatus = combineShadowStatus(
      !hasShadowStatus(next.shadowStatus),
      hasPurifiedStatus(next.shadowStatus),
    )
  }
  if (tag === 'purified') {
    next.shadowStatus = combineShadowStatus(
      hasShadowStatus(next.shadowStatus),
      !hasPurifiedStatus(next.shadowStatus),
    )
  }
  if (tag === 'costume') {
    next.costume = next.costume !== null ? null : ''
  }
  if (tag === 'background') {
    next.background = next.background !== null ? null : ''
  }
  if (!isBuiltInTag(tag)) {
    const extra = extraTagList(next)
    const turningOn = !extra.includes(tag)
    let nextExtra = turningOn ? [...extra, tag] : extra.filter((item) => item !== tag)
    if (turningOn && tag !== 'gender') nextExtra = nextExtra.filter((item) => item !== BASIC_CROP_TAG)
    if (isFormTag(tag)) next.form = formLabelFromExtra(nextExtra)
    if (tag === 'gender') next.gender = turningOn ? '' : null
    next.extraTags = nextExtra
    return next
  }
  if (specimenTags(next).includes(tag)) return dropBasicTag(next)
  return next
}

export function cropTagsFromFields(fields: SpecimenFields): TagId[] {
  const tags = specimenTags(fields)
  if (fields.form) {
    const formTag = FORM_TAGS.find((tag) => formNameForTag(tag) === fields.form)
    if (formTag && !tags.includes(formTag)) return [...tags, formTag]
  }
  return tags
}

export function tagSlugFromName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug || 'tag'
}

export function allocateCategoryTag(name: string, taken: Iterable<string>): string {
  const used = taken instanceof Set ? taken : new Set(taken)
  const base = tagSlugFromName(name)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export function resolveRequiredTags(
  picked: TagId[],
  options: { name: string; seed?: boolean; takenTags?: Iterable<string> },
): TagId[] {
  const tags = [...new Set(picked)]
  if (tags.length > 0) return tags
  if (options.seed) return []
  const taken = new Set<string>([...TAG_IDS, ...(options.takenTags ?? [])])
  return [allocateCategoryTag(options.name, taken)]
}

export function normalizeOptionalName(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

export function specimenSaveWarning(fields: SpecimenFields): string {
  if (!fields.speciesId) return 'Pick a species first'
  if (fields.costume !== null && !fields.costume.trim()) return 'Enter a costume name'
  if (fields.background !== null && !fields.background.trim()) return 'Enter a background name'
  if (extraTagList(fields).includes('gender') && !(fields.gender ?? '').trim()) {
    return 'Pick a gender variant'
  }
  return ''
}

export function categorySaveWarning(name: string): string {
  if (!name.trim()) return 'Name is required'
  return ''
}

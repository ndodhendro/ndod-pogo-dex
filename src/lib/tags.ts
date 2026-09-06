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
export type ShadowStatus = 'none' | 'shadow' | 'purified'

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
  hundo: boolean
  nundo: boolean
  extraTags?: TagId[]
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

export function labelForTag(tag: TagId): string {
  if (isBuiltInTag(tag)) return TAG_LABELS[tag]
  return formNameForTag(tag) ?? tag
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

export function clearVisualTags(fields: SpecimenFields): SpecimenFields {
  return {
    speciesId: fields.speciesId,
    form: null,
    shiny: false,
    shadowStatus: 'none',
    costume: null,
    background: null,
    hundo: false,
    nundo: false,
    extraTags: [],
  }
}

export function specimenTags(s: SpecimenFields): TagId[] {
  const tags: TagId[] = []
  if (s.shiny) tags.push('shiny')
  if (s.shadowStatus === 'shadow') tags.push('shadow')
  if (s.shadowStatus === 'purified') tags.push('purified')
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
    extraTagList(s).slice().sort().join(','),
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
  const next = { ...fields }
  if (tag === 'shiny') next.shiny = !next.shiny
  if (tag === 'hundo') {
    next.hundo = !next.hundo
    if (next.hundo) next.nundo = false
  }
  if (tag === 'nundo') {
    next.nundo = !next.nundo
    if (next.nundo) next.hundo = false
  }
  if (tag === 'shadow') {
    next.shadowStatus = next.shadowStatus === 'shadow' ? 'none' : 'shadow'
  }
  if (tag === 'purified') {
    next.shadowStatus = next.shadowStatus === 'purified' ? 'none' : 'purified'
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
    if (isFormTag(tag)) {
      if (turningOn) {
        nextExtra = nextExtra.filter((item) => !isFormTag(item) || item === tag)
        next.form = formNameForTag(tag) ?? null
      } else {
        next.form = null
      }
    }
    next.extraTags = nextExtra
  }
  return next
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
  return ''
}

export function categorySaveWarning(name: string): string {
  if (!name.trim()) return 'Name is required'
  return ''
}

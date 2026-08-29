export const TAG_IDS = [
  'shiny',
  'shadow',
  'purified',
  'costume',
  'background',
  'hundo',
  'nundo',
] as const

export type TagId = (typeof TAG_IDS)[number]
export type ShadowStatus = 'none' | 'shadow' | 'purified'

export type SpecimenFields = {
  speciesId: number
  form: string | null
  shiny: boolean
  shadowStatus: ShadowStatus
  costume: string | null
  background: string | null
  hundo: boolean
  nundo: boolean
}

export const TAG_LABELS: Record<TagId, string> = {
  shiny: 'Shiny',
  shadow: 'Shadow',
  purified: 'Purified',
  costume: 'Costume',
  background: 'Background',
  hundo: 'Hundo',
  nundo: 'Nundo',
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
  ].join('|')
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
    next.costume = next.costume ? null : ''
  }
  if (tag === 'background') {
    next.background = next.background ? null : ''
  }
  return next
}

export function normalizeOptionalName(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

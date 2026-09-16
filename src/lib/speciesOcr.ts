import { GO_FORM_SPECIES_IDS } from '../data/goFormReleased'
import { SPECIES } from '../data/species'
import { normalizeVariant, type DexSlotDef } from './roster'
import { specimenTags, toggleTag, type SpecimenFields } from './tags'

const FORM_PREFIX =
  /^(alolan|galarian|hisuian|paldean|mega|primal|shadow|purified|gigantamax|dynamax|origin|therian)\s+/
const SKIP_LINE =
  /^(cp(\s+\d+)*|hp(\b.*)?|atk|def|sta|stardust|candy|power up|evolve|transfer|appraise|weight|height|pokedex|ok|male|female|\d+([\/\s]+\d+)*)$/
const MAX_SUGGESTIONS = 12

export type OcrSpeciesResult = {
  rawText: string
  query: string
  kind: 'strong' | 'weak' | 'none'
  slot?: DexSlotDef
  /** Unique catalog species when OCR ranked to one species, even if variant slots are ambiguous. */
  speciesId?: number
  suggestions: DexSlotDef[]
}

export function isGenderDexSpecies(speciesId: number): boolean {
  return GO_FORM_SPECIES_IDS.gender.has(speciesId)
}

export function uniqueOcrSpeciesId(result: OcrSpeciesResult): number | undefined {
  if (result.speciesId) return result.speciesId
  if (result.slot?.speciesId) return result.slot.speciesId
  const ids = new Set(result.suggestions.map((row) => row.speciesId))
  if (ids.size === 1) return [...ids][0]
  return undefined
}

export function ocrMatchesGenderSpecies(result: OcrSpeciesResult): boolean {
  const speciesId = result.speciesId ?? result.slot?.speciesId
  return Boolean(speciesId && isGenderDexSpecies(speciesId))
}

export function applyOcrGenderSpecies(fields: SpecimenFields, speciesId: number): SpecimenFields {
  let next = { ...fields, speciesId }
  if (!specimenTags(next).includes('gender')) next = toggleTag(next, 'gender')
  return { ...next, speciesId, gender: '' }
}

function genderVariantRank(variant: string): number {
  const value = variant.trim().toLowerCase()
  if (value === 'male') return 0
  if (value === 'female') return 1
  if (value === 'hisuian male') return 2
  if (value === 'hisuian female') return 3
  return 50
}

export function genderSlotsForSpecies(
  slots: readonly DexSlotDef[],
  speciesId: number,
): DexSlotDef[] {
  if (!speciesId) return []
  return slots
    .filter((slot) => slot.speciesId === speciesId && Boolean(normalizeVariant(slot.variant)))
    .sort(
      (a, b) =>
        genderVariantRank(a.variant) - genderVariantRank(b.variant) ||
        a.variant.localeCompare(b.variant),
    )
}

type RankedSpecies = {
  id: number
  name: string
  normalized: string
  distance: number
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const n = a.length
  const m = b.length
  if (!n) return m
  if (!m) return n
  const prev = new Array<number>(m + 1)
  const curr = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    curr[0] = i
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= m; j++) prev[j] = curr[j]
  }
  return prev[m]
}

export function normalizeOcrName(text: string): string {
  let value = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, ' f')
    .replace(/♂/g, ' m')
    .replace(/[''`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  while (FORM_PREFIX.test(value)) value = value.replace(FORM_PREFIX, '')
  return value
}

export function displayOcrText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function compactName(value: string): string {
  return value.replace(/\s+/g, '')
}

function titleOcrName(normalized: string): string {
  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function ocrNameCandidates(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (text: string) => {
    const normalized = normalizeOcrName(text)
    if (!normalized || normalized.length < 3) return
    if (SKIP_LINE.test(normalized)) return
    if (seen.has(normalized)) return
    seen.add(normalized)
    out.push(normalized)
  }
  for (const line of raw.split(/\r?\n/)) add(line)
  add(raw)
  for (const token of normalizeOcrName(raw).split(' ')) {
    if (token.length >= 4) add(token)
  }
  return out
}

function containedDistance(candidate: string, speciesName: string): number | null {
  const words = candidate.split(' ')
  if (words.includes(speciesName)) return 0
  if (speciesName.split(' ').every((word) => word.length > 0 && words.includes(word))) {
    return Math.max(0, words.length - speciesName.split(' ').length)
  }
  const compactCandidate = compactName(candidate)
  const compactSpecies = compactName(speciesName)
  if (compactSpecies.length < 5 || !compactCandidate.includes(compactSpecies)) return null
  const extra = compactCandidate.length - compactSpecies.length
  if (extra > 2) return null
  return extra === 0 ? 0 : 1
}

function nameDistance(candidate: string, speciesName: string): number {
  if (candidate === speciesName) return 0
  const contained = containedDistance(candidate, speciesName)
  if (contained != null) return contained
  const compactCandidate = compactName(candidate)
  const compactSpecies = compactName(speciesName)
  if (compactCandidate === compactSpecies) return 0
  const speciesWords = speciesName.split(' ')
  if (speciesWords[0] === candidate) return speciesWords.length > 1 ? 1 : 0
  return Math.min(
    levenshtein(candidate, speciesName),
    levenshtein(compactCandidate, compactSpecies),
  )
}

function isStrongDistance(distance: number, nameLength: number): boolean {
  if (distance === 0) return true
  return distance === 1 && nameLength >= 5
}

function isPlausibleDistance(distance: number, nameLength: number): boolean {
  if (isStrongDistance(distance, nameLength)) return true
  if (distance === 1 && nameLength >= 4) return true
  return distance === 2 && nameLength >= 8
}

function rankSpecies(candidates: readonly string[]): RankedSpecies[] {
  if (candidates.length === 0) return []
  const ranked: RankedSpecies[] = []
  for (const species of SPECIES) {
    const normalized = normalizeOcrName(species.name)
    if (!normalized) continue
    let distance = Infinity
    for (const candidate of candidates) {
      distance = Math.min(distance, nameDistance(candidate, normalized))
      if (distance === 0) break
    }
    if (!Number.isFinite(distance)) continue
    if (!isPlausibleDistance(distance, compactName(normalized).length)) continue
    ranked.push({ id: species.id, name: species.name, normalized, distance })
  }
  ranked.sort((a, b) => a.distance - b.distance || a.id - b.id)
  return ranked
}

function slotsForSpecies(speciesId: number, slots: readonly DexSlotDef[]): DexSlotDef[] {
  return slots.filter((slot) => slot.speciesId === speciesId)
}

function slotForUniqueSpecies(
  species: RankedSpecies,
  slots: readonly DexSlotDef[],
): DexSlotDef | undefined {
  const hits = slotsForSpecies(species.id, slots)
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) {
    return { speciesId: species.id, variant: '', name: species.name }
  }
  return undefined
}

export function matchSpeciesFromOcr(
  rawText: string,
  slots: readonly DexSlotDef[],
): OcrSpeciesResult {
  const raw = rawText.trim()
  const queryRaw = displayOcrText(raw)
  const empty: OcrSpeciesResult = {
    rawText: raw,
    query: queryRaw,
    kind: 'none',
    suggestions: [],
  }
  if (!raw) return empty

  const candidates = ocrNameCandidates(raw)
  const ranked = rankSpecies(candidates)
  if (ranked.length === 0) return empty

  const exact = ranked.filter((row) => row.distance === 0)
  const close = ranked.filter(
    (row) =>
      row.distance > 0 && isStrongDistance(row.distance, compactName(row.normalized).length),
  )
  const uniqueStrong =
    exact.length === 1 ? exact[0] : exact.length === 0 && close.length === 1 ? close[0] : undefined
  if (uniqueStrong) {
    const slot = slotForUniqueSpecies(uniqueStrong, slots)
    if (slot) {
      return {
        rawText: raw,
        query: slot.name,
        kind: 'strong',
        slot,
        speciesId: uniqueStrong.id,
        suggestions: [],
      }
    }
  }

  const suggestions: DexSlotDef[] = []
  const seen = new Set<string>()
  const pushSlot = (slot: DexSlotDef) => {
    const key = `${slot.speciesId}:${slot.variant}`
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push(slot)
  }
  const rows = exact.length > 1 ? exact : ranked
  for (const row of rows) {
    for (const slot of slotsForSpecies(row.id, slots)) pushSlot(slot)
    if (suggestions.length >= MAX_SUGGESTIONS) break
  }

  const bestCandidate =
    candidates.find((candidate) => nameDistance(candidate, ranked[0].normalized) === ranked[0].distance) ??
    candidates[0]

  return {
    rawText: raw,
    query: titleOcrName(bestCandidate),
    kind: suggestions.length > 0 ? 'weak' : 'none',
    speciesId: uniqueStrong?.id,
    suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
  }
}

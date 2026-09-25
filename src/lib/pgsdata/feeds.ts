import { priorEvolutions } from '../../data/evolutions'
import { isGoReleased } from '../../data/goReleased'
import { isGreenCover } from '../covers'
import type { CategoryRow, SpecimenRow, TagCatalogRow, TagRosterRow } from '../db'
import { slotsForTrack } from '../roster'
import { isNotPure, isSilhouette, specimenTags, type TagId } from '../tags'

export type PgsFeed = {
  name?: string
  pokemons?: number[]
  [key: string]: unknown
}

export type FeedRebuildStats = {
  skipped: number
  rebuilt: number
  created: number
  dropped: number
}

export const FEED_POKEMON_LIMIT = 300

/**
 * Branch root kept in a feed while any direct evolution with a different dex ID
 * is still missing from that category. Further linear stages do not keep the root.
 * Tyrogue is left out: it is rarer than Hitmonlee, Hitmonchan, and Hitmontop.
 * Form-locked lines are left out. Each form has one evolution:
 * Meowth to Persian or Perrserker, Wooper to Quagsire or Clodsire,
 * Sneasel to Weavile or Sneasler, Yamask to Cofagrigus or Runerigus.
 */
const BRANCH_FEED_ANCHORS: ReadonlyMap<number, readonly number[]> = new Map([
  [44, [45, 182]],
  [61, [62, 186]],
  [79, [80, 199]],
  [123, [212, 900]],
  [133, [134, 135, 136, 196, 197, 470, 471, 700]],
  [265, [266, 268]],
  [281, [282, 475]],
  [290, [291, 292]],
  [361, [362, 478]],
  [366, [367, 368]],
  [412, [413, 414]],
  [790, [791, 792]],
  [840, [841, 842, 1011]],
  [935, [936, 937]],
])

const ROMAN_GLYPHS: readonly [string, number][] = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
]

const ROMAN_FEED = /^(.+?)\s+([ivxlcdm]+)$/i
const NUMBERED_FEED = /^(.+?)\s+(\d{3,4})$/

export function dumpFeedsJson(feeds: PgsFeed[]) {
  return JSON.stringify(feeds)
}

export function parseFeedsJson(raw: string): PgsFeed[] {
  const value = JSON.parse(raw) as unknown
  if (!Array.isArray(value)) throw new Error('hlfeeds is not a JSON array')
  return value as PgsFeed[]
}

export function normalizeFeedLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\bforme\b/g, 'form')
    .replace(/\s+/g, ' ')
}

export function formatRoman(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 3999) {
    throw new Error('Roman numeral out of range')
  }
  let rest = value
  let out = ''
  for (const [glyph, amount] of ROMAN_GLYPHS) {
    while (rest >= amount) {
      out += glyph
      rest -= amount
    }
  }
  return out
}

export function parseRoman(raw: string): number | null {
  const value = raw.trim().toUpperCase()
  if (!value || !/^[IVXLCDM]+$/.test(value)) return null
  let i = 0
  let total = 0
  for (const [glyph, amount] of ROMAN_GLYPHS) {
    while (value.startsWith(glyph, i)) {
      total += amount
      i += glyph.length
    }
  }
  if (i !== value.length) return null
  if (formatRoman(total) !== value) return null
  return total
}

export function feedStem(name: string) {
  const trimmed = name.trim()
  const roman = trimmed.match(ROMAN_FEED)
  if (roman && parseRoman(roman[2]) != null) return roman[1]
  const numbered = trimmed.match(NUMBERED_FEED)
  return numbered ? numbered[1] : trimmed
}

/** Lowest national dex id in a feed, or 0 when the list is empty. */
export function minFeedDexId(pokemons: readonly number[]) {
  let min = 0
  for (const id of pokemons) {
    if (min === 0 || id < min) min = id
  }
  return min
}

/** Feed postfix is that list's min dex id (`Basic 001`, `Basic 151`, `Basic 1008`). */
export function numberedFeedName(stem: string, pokemons: readonly number[]) {
  return `${stem.trim()} ${String(minFeedDexId(pokemons)).padStart(3, '0')}`
}

export function chunkSpeciesIds(ids: readonly number[], size = FEED_POKEMON_LIMIT): number[][] {
  if (ids.length === 0) return [[]]
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

function genderRoleFromName(name: string): 'male' | 'female' | null {
  const key = normalizeFeedLabel(name)
  if (key === 'male') return 'male'
  if (key === 'female') return 'female'
  return null
}

function genderRoleFromSpecimen(gender: string | null | undefined): 'male' | 'female' | null {
  const key = (gender ?? '').trim().toLowerCase()
  if (key === 'male' || key === 'hisuian male') return 'male'
  if (key === 'female' || key === 'hisuian female') return 'female'
  return null
}

function isGenderCategory(required: readonly TagId[]) {
  return required.length === 1 && required[0] === 'gender'
}

export function matchFeedCategory(feedName: string, categories: readonly CategoryRow[]): CategoryRow | null {
  const stem = feedStem(feedName)
  const gender = genderRoleFromName(stem)
  if (gender) {
    return categories.find((row) => isGenderCategory(row.requiredTags)) ?? null
  }
  const wanted = normalizeFeedLabel(stem)
  return categories.find((row) => normalizeFeedLabel(row.name) === wanted) ?? null
}

export function pureSpeciesByFeedKey(
  specimens: readonly SpecimenRow[],
  categories: readonly CategoryRow[],
): Map<string, Set<number>> {
  const byKey = new Map<string, Set<number>>()

  function add(key: string, speciesId: number) {
    const set = byKey.get(key) ?? new Set<number>()
    set.add(speciesId)
    byKey.set(key, set)
  }

  for (const specimen of specimens) {
    if (isSilhouette(specimen)) continue
    const tags = specimenTags(specimen)
    for (const category of categories) {
      if (
        !isGreenCover(
          tags,
          category.requiredTags,
          false,
          specimen.speciesId,
          specimen.gender,
          isNotPure(specimen),
        )
      ) {
        continue
      }
      add(normalizeFeedLabel(category.name), specimen.speciesId)
      if (isGenderCategory(category.requiredTags)) {
        const role = genderRoleFromSpecimen(specimen.gender)
        if (role) add(role, specimen.speciesId)
      }
    }
  }
  return byKey
}

export function catalogSpeciesIds(
  category: CategoryRow,
  catalogs: readonly TagCatalogRow[],
  roster: readonly TagRosterRow[],
): number[] {
  const ids = new Set<number>()
  for (const slot of slotsForTrack(category.requiredTags, catalogs, roster)) {
    ids.add(slot.speciesId)
  }
  return [...ids].sort((a, b) => a - b)
}

function keepBranchAnchors(remaining: readonly number[], catalogIds: readonly number[]): number[] {
  const open = new Set(remaining)
  const catalog = new Set(catalogIds)
  const extras: number[] = []
  for (const [anchor, branches] of BRANCH_FEED_ANCHORS) {
    if (!catalog.has(anchor) || open.has(anchor)) continue
    if (branches.some((id) => open.has(id))) extras.push(anchor)
  }
  if (extras.length === 0) return [...remaining]
  const out: number[] = []
  let index = 0
  for (const id of extras) {
    while (index < remaining.length && remaining[index] < id) out.push(remaining[index++])
    out.push(id)
  }
  while (index < remaining.length) out.push(remaining[index++])
  return out
}

/**
 * A gender difference past stage 1 is often unavailable in the wild.
 * Until that species is pure, the feed also lists every earlier stage
 * so it can be caught and evolved. Male and Female stay separate.
 */
function withGenderPreEvolutions(remaining: readonly number[]): number[] {
  const ids = new Set(remaining)
  for (const speciesId of remaining) {
    for (const prior of priorEvolutions(speciesId)) {
      if (isGoReleased(prior)) ids.add(prior)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

function remainingSpeciesIds(
  category: CategoryRow,
  stem: string,
  catalogs: readonly TagCatalogRow[],
  roster: readonly TagRosterRow[],
  pure: Map<string, Set<number>>,
) {
  const gender = genderRoleFromName(stem)
  const drop = gender
    ? (pure.get(gender) ?? new Set())
    : (pure.get(normalizeFeedLabel(category.name)) ?? new Set())
  const catalogIds = catalogSpeciesIds(category, catalogs, roster)
  const anchored = keepBranchAnchors(
    catalogIds.filter((id) => !drop.has(id)),
    catalogIds,
  )
  if (!isGenderCategory(category.requiredTags)) return anchored
  return withGenderPreEvolutions(anchored)
}

function copyFeed(template: PgsFeed, name: string, pokemons: number[]): PgsFeed {
  return { ...template, name, pokemons }
}

export function rebuildFeeds(
  feeds: PgsFeed[],
  specimens: readonly SpecimenRow[],
  categories: readonly CategoryRow[],
  catalogs: readonly TagCatalogRow[] = [],
  roster: readonly TagRosterRow[] = [],
): { feeds: PgsFeed[]; stats: FeedRebuildStats } {
  const pure = pureSpeciesByFeedKey(specimens, categories)
  const seen = new Set<string>()
  const next: PgsFeed[] = []
  let skipped = 0
  let rebuilt = 0
  let created = 0
  let dropped = 0

  for (const feed of feeds) {
    const name = String(feed.name ?? '')
    const category = matchFeedCategory(name, categories)
    if (!category) {
      next.push(feed)
      skipped += 1
      continue
    }
    const stem = feedStem(name)
    const stemKey = normalizeFeedLabel(stem)
    if (seen.has(stemKey)) continue
    seen.add(stemKey)

    const groupCount = feeds.filter((row) => {
      const rowName = String(row.name ?? '')
      return matchFeedCategory(rowName, categories) && normalizeFeedLabel(feedStem(rowName)) === stemKey
    }).length
    const remaining = remainingSpeciesIds(category, stem, catalogs, roster, pure)
    const chunks = chunkSpeciesIds(remaining)
    rebuilt += chunks.length
    if (chunks.length > groupCount) created += chunks.length - groupCount
    if (groupCount > chunks.length) dropped += groupCount - chunks.length
    for (const pokemons of chunks) {
      next.push(copyFeed(feed, numberedFeedName(stem, pokemons), pokemons))
    }
  }

  return { feeds: next, stats: { skipped, rebuilt, created, dropped } }
}

export function rebuildSummary(stats: FeedRebuildStats) {
  const bits = [
    stats.rebuilt ? `filled ${stats.rebuilt} feed${stats.rebuilt === 1 ? '' : 's'}` : null,
    stats.created ? `added ${stats.created}` : null,
    stats.dropped ? `removed ${stats.dropped} extra` : null,
    stats.skipped ? `skipped ${stats.skipped}` : null,
  ].filter(Boolean)
  return bits.length > 0 ? bits.join(', ') : 'no matching feeds'
}

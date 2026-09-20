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

export function numberedFeedName(stem: string, index: number) {
  return `${stem.trim()} ${formatRoman(index)}`
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
  return catalogSpeciesIds(category, catalogs, roster).filter((id) => !drop.has(id))
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
    chunks.forEach((pokemons, index) => {
      next.push(copyFeed(feed, numberedFeedName(stem, index + 1), pokemons))
    })
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

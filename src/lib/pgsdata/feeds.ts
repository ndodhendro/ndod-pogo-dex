import { isGreenCover } from '../covers'
import type { CategoryRow, SpecimenRow, TagCatalogRow, TagRosterRow } from '../db'
import { slotsForTrack } from '../roster'
import { isSilhouette, specimenTags, type TagId } from '../tags'

export type PgsFeed = {
  name?: string
  pokemons?: number[]
  [key: string]: unknown
}

export type FeedSyncChange = {
  name: string
  removed: number[]
  added: number[]
}

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

export function feedStem(name: string) {
  const numbered = name.trim().match(NUMBERED_FEED)
  return numbered ? numbered[1] : name.trim()
}

export function numberedFeedStart(name: string): number | null {
  const numbered = name.trim().match(NUMBERED_FEED)
  return numbered ? Number(numbered[2]) : null
}

export function feedDexRange(
  name: string,
  feeds: readonly PgsFeed[],
): { min: number; max: number } | null {
  const start = numberedFeedStart(name)
  if (start == null) return null
  const stem = normalizeFeedLabel(feedStem(name))
  const starts = [
    ...new Set(
      feeds
        .map((feed) => String(feed.name ?? ''))
        .filter((feedName) => normalizeFeedLabel(feedStem(feedName)) === stem)
        .map((feedName) => numberedFeedStart(feedName))
        .filter((value): value is number => value != null),
    ),
  ].sort((a, b) => a - b)
  const index = starts.indexOf(start)
  const max = index >= 0 && index < starts.length - 1 ? starts[index + 1] - 1 : Number.POSITIVE_INFINITY
  return { min: start, max }
}

function inRange(id: number, range: { min: number; max: number } | null) {
  if (!range) return true
  return id >= range.min && id <= range.max
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
): Set<number> {
  const ids = new Set<number>()
  for (const slot of slotsForTrack(category.requiredTags, catalogs, roster)) {
    ids.add(slot.speciesId)
  }
  return ids
}

function desiredIds(
  universe: Set<number>,
  range: { min: number; max: number } | null,
  pure: Set<number>,
) {
  const desired = new Set<number>()
  for (const id of universe) {
    if (!inRange(id, range)) continue
    if (pure.has(id)) continue
    desired.add(id)
  }
  return desired
}

function syncPokemonList(current: number[], desired: Set<number>) {
  const seen = new Set<number>()
  const kept: number[] = []
  const removed: number[] = []
  for (const id of current) {
    if (!desired.has(id)) {
      removed.push(id)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    kept.push(id)
  }
  const added = [...desired].filter((id) => !seen.has(id)).sort((a, b) => a - b)
  return { pokemons: [...kept, ...added], added, removed }
}

export function syncFeeds(
  feeds: PgsFeed[],
  specimens: readonly SpecimenRow[],
  categories: readonly CategoryRow[],
  catalogs: readonly TagCatalogRow[] = [],
  roster: readonly TagRosterRow[] = [],
): { feeds: PgsFeed[]; changes: FeedSyncChange[] } {
  const pure = pureSpeciesByFeedKey(specimens, categories)
  const changes: FeedSyncChange[] = []
  const next = feeds.map((feed) => {
    const name = String(feed.name ?? '')
    const category = matchFeedCategory(name, categories)
    if (!category || !Array.isArray(feed.pokemons)) return feed
    const stem = feedStem(name)
    const gender = genderRoleFromName(stem)
    const drop = gender
      ? (pure.get(gender) ?? new Set())
      : (pure.get(normalizeFeedLabel(category.name)) ?? new Set())
    const universe = catalogSpeciesIds(category, catalogs, roster)
    const desired = desiredIds(universe, feedDexRange(name, feeds), drop)
    const synced = syncPokemonList(feed.pokemons, desired)
    if (synced.added.length === 0 && synced.removed.length === 0) return feed
    changes.push({ name, removed: synced.removed, added: synced.added })
    return { ...feed, pokemons: synced.pokemons }
  })
  return { feeds: next, changes }
}

export function countRemoved(changes: readonly FeedSyncChange[]) {
  return changes.reduce((sum, row) => sum + row.removed.length, 0)
}

export function countAdded(changes: readonly FeedSyncChange[]) {
  return changes.reduce((sum, row) => sum + row.added.length, 0)
}

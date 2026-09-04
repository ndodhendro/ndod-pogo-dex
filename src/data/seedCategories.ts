import { CATEGORY_ICONS, TAG_ICONS, TONE_TEXT_HEX } from './navIcons'
import type { TagId } from '../lib/tags'

export const SEED_CATEGORIES: {
  id: string
  name: string
  requiredTags: TagId[]
  sortOrder: number
  seed: boolean
  emoji: string
  labelColor: string
}[] = [
  {
    id: 'seed:living',
    name: 'Basic',
    requiredTags: [],
    sortOrder: 0,
    seed: true,
    emoji: CATEGORY_ICONS.Basic,
    labelColor: TONE_TEXT_HEX.living,
  },
  {
    id: 'seed:shiny',
    name: 'Shiny',
    requiredTags: ['shiny'],
    sortOrder: 1,
    seed: true,
    emoji: TAG_ICONS.shiny,
    labelColor: TONE_TEXT_HEX.shiny,
  },
  {
    id: 'seed:shadow',
    name: 'Shadow',
    requiredTags: ['shadow'],
    sortOrder: 2,
    seed: true,
    emoji: TAG_ICONS.shadow,
    labelColor: TONE_TEXT_HEX.shadow,
  },
  {
    id: 'seed:purified',
    name: 'Purified',
    requiredTags: ['purified'],
    sortOrder: 3,
    seed: true,
    emoji: TAG_ICONS.purified,
    labelColor: TONE_TEXT_HEX.purified,
  },
  {
    id: 'seed:costume',
    name: 'Costume',
    requiredTags: ['costume'],
    sortOrder: 4,
    seed: true,
    emoji: TAG_ICONS.costume,
    labelColor: TONE_TEXT_HEX.costume,
  },
  {
    id: 'seed:background',
    name: 'Background',
    requiredTags: ['background'],
    sortOrder: 5,
    seed: true,
    emoji: TAG_ICONS.background,
    labelColor: TONE_TEXT_HEX.background,
  },
  {
    id: 'seed:hundo',
    name: 'Hundo',
    requiredTags: ['hundo'],
    sortOrder: 6,
    seed: true,
    emoji: TAG_ICONS.hundo,
    labelColor: TONE_TEXT_HEX.hundo,
  },
  {
    id: 'seed:nundo',
    name: 'Nundo',
    requiredTags: ['nundo'],
    sortOrder: 7,
    seed: true,
    emoji: TAG_ICONS.nundo,
    labelColor: TONE_TEXT_HEX.nundo,
  },
]

/**
 * Shared UUIDs used by the first cloud backup. `categories.id` was a global
 * primary key, so only one account could own these rows. Keep using them when
 * this user already has them; otherwise derive a per-user id.
 */
export const SEED_CLOUD_IDS: Record<string, string> = {
  'seed:living': '01000000-0000-4000-8000-000000000001',
  'seed:shiny': '01000000-0000-4000-8000-000000000002',
  'seed:shadow': '01000000-0000-4000-8000-000000000003',
  'seed:purified': '01000000-0000-4000-8000-000000000004',
  'seed:costume': '01000000-0000-4000-8000-000000000005',
  'seed:background': '01000000-0000-4000-8000-000000000006',
  'seed:hundo': '01000000-0000-4000-8000-000000000007',
  'seed:nundo': '01000000-0000-4000-8000-000000000008',
}

export const LEGACY_SEED_CLOUD_IDS = Object.values(SEED_CLOUD_IDS)

/** Older cloud/local rows used Living or Pokémon for the empty-tag seed track. */
export const LEGACY_SEED_NAMES: Record<string, string> = {
  Living: 'Basic',
  Pokémon: 'Basic',
  Pokemon: 'Basic',
}

export function canonicalSeedName(name: string) {
  return LEGACY_SEED_NAMES[name] ?? name
}

export function seedCategoryById(id: string) {
  return SEED_CATEGORIES.find((row) => row.id === id)
}

/** Deterministic UUID so each signed-in account can backup the same seed tracks. */
export function perUserSeedCloudId(userId: string, seedLocalId: string) {
  const index = SEED_CATEGORIES.findIndex((row) => row.id === seedLocalId)
  if (index < 0) return seedLocalId
  return `${userId.slice(0, 24)}${(index + 1).toString(16).padStart(12, '0')}`
}

export function toCloudCategoryId(
  id: string,
  userId: string,
  ownedLegacyIds: ReadonlySet<string> = new Set(),
) {
  const legacy = SEED_CLOUD_IDS[id]
  if (!legacy) return id
  if (ownedLegacyIds.has(legacy)) return legacy
  return perUserSeedCloudId(userId, id)
}

export function fromCloudCategoryId(
  id: string,
  userId?: string,
  meta?: { name?: string; seed?: boolean },
) {
  const legacy = Object.entries(SEED_CLOUD_IDS).find(([, cloud]) => cloud === id)
  if (legacy) return legacy[0]
  if (userId) {
    const seed = SEED_CATEGORIES.find((row) => perUserSeedCloudId(userId, row.id) === id)
    if (seed) return seed.id
  }
  if (meta?.seed && meta.name) {
    const seedName = meta.name
    const named = SEED_CATEGORIES.find((row) => row.name === canonicalSeedName(seedName))
    if (named) return named.id
  }
  return id
}

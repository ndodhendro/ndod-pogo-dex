import type { TagId } from '../lib/tags'

export const SEED_CATEGORIES: {
  id: string
  name: string
  requiredTags: TagId[]
  sortOrder: number
  seed: boolean
}[] = [
  { id: 'seed:living', name: 'Living', requiredTags: [], sortOrder: 0, seed: true },
  { id: 'seed:shiny', name: 'Shiny', requiredTags: ['shiny'], sortOrder: 1, seed: true },
  { id: 'seed:shadow', name: 'Shadow', requiredTags: ['shadow'], sortOrder: 2, seed: true },
  { id: 'seed:purified', name: 'Purified', requiredTags: ['purified'], sortOrder: 3, seed: true },
  { id: 'seed:costume', name: 'Costume', requiredTags: ['costume'], sortOrder: 4, seed: true },
  { id: 'seed:background', name: 'Background', requiredTags: ['background'], sortOrder: 5, seed: true },
  { id: 'seed:hundo', name: 'Hundo', requiredTags: ['hundo'], sortOrder: 6, seed: true },
  { id: 'seed:nundo', name: 'Nundo', requiredTags: ['nundo'], sortOrder: 7, seed: true },
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
    const named = SEED_CATEGORIES.find((row) => row.name === meta.name)
    if (named) return named.id
  }
  return id
}

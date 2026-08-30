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

/** Postgres category ids are UUID; local seed ids are slugs. */
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

export function toCloudCategoryId(id: string) {
  return SEED_CLOUD_IDS[id] ?? id
}

export function fromCloudCategoryId(id: string) {
  const found = Object.entries(SEED_CLOUD_IDS).find(([, cloud]) => cloud === id)
  return found ? found[0] : id
}

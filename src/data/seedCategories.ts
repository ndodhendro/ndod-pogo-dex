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

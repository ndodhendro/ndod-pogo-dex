import Dexie, { type Table } from 'dexie'
import { SEED_CATEGORIES } from '../data/seedCategories'
import type { ShadowStatus, TagId } from './tags'

export type SpecimenRow = {
  id: string
  speciesId: number
  form: string | null
  shiny: boolean
  shadowStatus: ShadowStatus
  costume: string | null
  background: string | null
  hundo: boolean
  nundo: boolean
  imageId: string
  fileHash?: string | null
  createdAt: number
}

export type ImageRow = {
  id: string
  original: Blob
  thumb: Blob
  medium: Blob
}

export type InboxRow = {
  id: string
  imageId: string
  createdAt: number
}

export type CategoryRow = {
  id: string
  name: string
  requiredTags: TagId[]
  sortOrder: number
  seed: boolean
}

export type CoverRow = {
  categoryId: string
  speciesId: number
  specimenId: string
}

class PogoDexDB extends Dexie {
  specimens!: Table<SpecimenRow, string>
  images!: Table<ImageRow, string>
  inbox!: Table<InboxRow, string>
  categories!: Table<CategoryRow, string>
  covers!: Table<CoverRow, [string, number]>

  constructor() {
    super('ndod-pogo-dex')
    this.version(1).stores({
      specimens: 'id, speciesId, createdAt, imageId',
      images: 'id',
      inbox: 'id, createdAt, imageId',
      categories: 'id, sortOrder',
      covers: '[categoryId+speciesId], specimenId, categoryId',
    })
    this.version(2).stores({
      specimens: 'id, speciesId, createdAt, imageId, fileHash',
      images: 'id',
      inbox: 'id, createdAt, imageId',
      categories: 'id, sortOrder',
      covers: '[categoryId+speciesId], specimenId, categoryId',
    })
  }
}

export const db = new PogoDexDB()

export async function ensureSeedCategories() {
  const count = await db.categories.count()
  if (count > 0) return
  await db.categories.bulkAdd(SEED_CATEGORIES)
}

import Dexie, { type Table } from 'dexie'
import { colorForCategory, iconForCategory } from '../data/navIcons'
import { SEED_CATEGORIES, LEGACY_SEED_NAMES } from '../data/seedCategories'
import { SEED_TAG_CROPS } from '../data/tagCrops'
import type { SlotMode } from './roster'
import { allocateCategoryTag, TAG_IDS, type ShadowStatus, type TagId } from './tags'
import { clampCropBottom } from './screenshotCrop'

export type SpecimenRow = {
  id: string
  speciesId: number
  form: string | null
  shiny: boolean
  shadowStatus: ShadowStatus
  costume: string | null
  background: string | null
  gender?: string | null
  hundo: boolean
  nundo: boolean
  extraTags?: TagId[]
  silhouette?: boolean
  imageId: string
  fileHash?: string | null
  createdAt: number
  /** False after a confirmed cloud upsert. Missing/true means Backup collection should retry. */
  cloudBackupPending?: boolean
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
  emoji?: string
  labelColor?: string
  /** False after a confirmed cloud upsert. Missing/true means a later pull must keep this local row. */
  cloudBackupPending?: boolean
}

export type CoverRow = {
  categoryId: string
  speciesId: number
  /** Empty string for species-mode tracks. */
  variant: string
  specimenId: string
}

export type TagCatalogRow = {
  tag: string
  limitPokedex: boolean
  slotMode: SlotMode
  cloudBackupPending?: boolean
}

export type TagRosterRow = {
  tag: string
  speciesId: number
  variant: string
  cloudBackupPending?: boolean
}

export type TagCropRow = {
  tag: string
  height: number
}

class PogoDexDB extends Dexie {
  specimens!: Table<SpecimenRow, string>
  images!: Table<ImageRow, string>
  inbox!: Table<InboxRow, string>
  categories!: Table<CategoryRow, string>
  covers!: Table<CoverRow, [string, number, string]>
  tagCrops!: Table<TagCropRow, string>
  tagCatalogs!: Table<TagCatalogRow, string>
  tagRoster!: Table<TagRosterRow, [string, number, string]>

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
    this.version(3).upgrade(async (tx) => {
      const table = tx.table('categories')
      const rows = (await table.toArray()) as CategoryRow[]
      for (const row of rows) {
        const patch: Partial<CategoryRow> = {}
        if (!row.emoji) patch.emoji = iconForCategory(row)
        if (!row.labelColor) patch.labelColor = colorForCategory(row)
        if (Object.keys(patch).length > 0) await table.update(row.id, patch)
      }
    })
    this.version(4).stores({
      specimens: 'id, speciesId, createdAt, imageId, fileHash, cloudBackupPending',
    })
    this.version(5).stores({
      categories: 'id, sortOrder, cloudBackupPending',
    })
    this.version(6).stores({
      tagCrops: 'tag',
    })
    this.version(7).stores({
      tagCatalogs: 'tag',
      tagRoster: '[tag+speciesId+variant], tag, speciesId',
      coverCopy: '[categoryId+speciesId+variant], [categoryId+speciesId], specimenId, categoryId',
    }).upgrade(async (tx) => {
      const rows = (await tx.table('covers').toArray()) as CoverRow[]
      await tx.table('coverCopy').bulkPut(
        rows.map((row) => ({
          categoryId: row.categoryId,
          speciesId: row.speciesId,
          variant: typeof row.variant === 'string' ? row.variant : '',
          specimenId: row.specimenId,
        })),
      )
    })
    this.version(8).stores({
      covers: null,
    })
    this.version(9).stores({
      covers: '[categoryId+speciesId+variant], [categoryId+speciesId], specimenId, categoryId',
    }).upgrade(async (tx) => {
      const rows = await tx.table('coverCopy').toArray()
      if (rows.length > 0) await tx.table('covers').bulkPut(rows)
    })
    this.version(10).stores({
      coverCopy: null,
    })
  }
}

export const db = new PogoDexDB()

const SEEDED_FLAG = 'ndod-pogo-dex:seed-categories'

export async function ensureSeedCategories() {
  const count = await db.categories.count()
  if (count === 0) {
    if (localStorage.getItem(SEEDED_FLAG) !== '1') {
      await db.categories.bulkAdd(SEED_CATEGORIES)
      localStorage.setItem(SEEDED_FLAG, '1')
    }
  } else {
    localStorage.setItem(SEEDED_FLAG, '1')
    for (const seed of SEED_CATEGORIES) {
      const row = await db.categories.get(seed.id)
      const renamed = row ? LEGACY_SEED_NAMES[row.name] : undefined
      const patch: Partial<CategoryRow> = {}
      if (row && renamed && renamed !== row.name) patch.name = renamed
      if (row && !row.emoji) patch.emoji = seed.emoji
      if (row && !row.labelColor) patch.labelColor = seed.labelColor
      if (row && Object.keys(patch).length > 0) await db.categories.update(seed.id, patch)
    }
    await ensureCustomCategoryTags()
  }
  await ensureSeedTagCrops()
}

export async function ensureSeedTagCrops() {
  await db.tagCrops.bulkPut(
    SEED_TAG_CROPS.map((row) => ({
      tag: row.tag,
      height: clampCropBottom(row.height),
    })),
  )
}

/** Custom tracks saved with no picked tags become their own atomic tag (Lucky → lucky). */
export async function ensureCustomCategoryTags() {
  const rows = await db.categories.toArray()
  const taken = new Set<string>(TAG_IDS)
  for (const row of rows) {
    for (const tag of row.requiredTags) taken.add(tag)
  }
  for (const row of rows) {
    if (row.seed || row.requiredTags.length > 0) continue
    const tag = allocateCategoryTag(row.name, taken)
    taken.add(tag)
    await db.categories.update(row.id, { requiredTags: [tag] })
  }
}

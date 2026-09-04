import { describe, expect, it } from 'vitest'
import { perUserSeedCloudId } from '../data/seedCategories'
import {
  categoryNeedsCloudBackup,
  mapCloudCategory,
  mergeCategoryPull,
  shouldApplyRemoteCategory,
  type CloudCategoryRaw,
} from './categorySyncPlan'
import type { CategoryRow } from './db'

const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function local(partial: Partial<CategoryRow> & Pick<CategoryRow, 'id' | 'name'>): CategoryRow {
  return {
    requiredTags: [],
    sortOrder: 0,
    seed: false,
    ...partial,
  }
}

function raw(partial: Partial<CloudCategoryRaw> & Pick<CloudCategoryRaw, 'id' | 'name'>): CloudCategoryRaw {
  return {
    required_tags: [],
    sort_order: 0,
    seed: false,
    ...partial,
  }
}

describe('categoryNeedsCloudBackup', () => {
  it('keeps a failed local add until upsert succeeds', () => {
    expect(categoryNeedsCloudBackup({ cloudBackupPending: true })).toBe(true)
    expect(categoryNeedsCloudBackup({})).toBe(true)
    expect(categoryNeedsCloudBackup({ cloudBackupPending: false })).toBe(false)
  })
})

describe('mapCloudCategory', () => {
  it('maps per-user seed uuids back to seed:* and acks the row', () => {
    const id = perUserSeedCloudId(userId, 'seed:shadow')
    expect(mapCloudCategory(raw({ id, name: 'Shadow', seed: true, required_tags: ['shadow'] }), userId)).toEqual({
      id: 'seed:shadow',
      name: 'Shadow',
      requiredTags: ['shadow'],
      sortOrder: 0,
      seed: true,
      emoji: undefined,
      labelColor: undefined,
      cloudBackupPending: false,
    })
  })

  it('renames the empty-tag seed track from Pokémon or Living to Basic', () => {
    const id = perUserSeedCloudId(userId, 'seed:living')
    expect(mapCloudCategory(raw({ id, name: 'Pokémon', seed: true }), userId).name).toBe('Basic')
    expect(mapCloudCategory(raw({ id, name: 'Living', seed: true }), userId).name).toBe('Basic')
  })

  it('keeps combo required tags instead of inventing a combo tag name', () => {
    const id = '7f1d3a2e-1111-4aaa-8bbb-cccccccccccccccc'
    const row = mapCloudCategory(
      raw({ id, name: 'Shadow Hundo', required_tags: ['shadow', 'hundo'], sort_order: 8 }),
      userId,
    )
    expect(row.id).toBe(id)
    expect(row.name).toBe('Shadow Hundo')
    expect(row.requiredTags).toEqual(['shadow', 'hundo'])
    expect(row.requiredTags).not.toContain('shadow_hundo')
  })
})

describe('mergeCategoryPull', () => {
  it('keeps a pending local custom category that is not in cloud yet', () => {
    const pending = local({
      id: 'lucky-local',
      name: 'Lucky',
      requiredTags: ['lucky'],
      cloudBackupPending: true,
    })
    const cloud = [
      local({ id: 'seed:living', name: 'Basic', seed: true, cloudBackupPending: false }),
    ]
    const { next, removeIds } = mergeCategoryPull([pending, cloud[0]], cloud)
    expect(next.map((row) => row.id).sort()).toEqual(['lucky-local', 'seed:living'])
    expect(removeIds).toEqual([])
  })

  it('replaces pending local seeds with the cloud copy so device seeds do not clobber', () => {
    const localSeed = local({
      id: 'seed:living',
      name: 'Basic',
      seed: true,
      sortOrder: 0,
    })
    const cloudSeed = local({
      id: 'seed:living',
      name: 'Basic',
      seed: true,
      sortOrder: 3,
      cloudBackupPending: false,
    })
    expect(mergeCategoryPull([localSeed], [cloudSeed]).next).toEqual([cloudSeed])
  })

  it('does not overwrite a pending local custom edit with the cloud copy', () => {
    const pending = local({
      id: 'cat-1',
      name: 'Lucky',
      requiredTags: ['lucky'],
      cloudBackupPending: true,
    })
    const cloud = [
      local({
        id: 'cat-1',
        name: 'Lucky',
        requiredTags: ['lucky'],
        sortOrder: 9,
        cloudBackupPending: false,
      }),
    ]
    expect(mergeCategoryPull([pending], cloud).next).toEqual([pending])
  })

  it('drops acked local rows that are gone from cloud', () => {
    const gone = local({
      id: 'old-custom',
      name: 'Old',
      requiredTags: ['old'],
      cloudBackupPending: false,
    })
    const kept = local({
      id: 'seed:living',
      name: 'Basic',
      seed: true,
      cloudBackupPending: false,
    })
    const { next, removeIds } = mergeCategoryPull([gone, kept], [kept])
    expect(next).toEqual([kept])
    expect(removeIds).toEqual(['old-custom'])
  })

  it('drops a local seed that was deleted in cloud even if it was never acked', () => {
    const localNundo = local({
      id: 'seed:nundo',
      name: 'Nundo',
      requiredTags: ['nundo'],
      seed: true,
    })
    const living = local({
      id: 'seed:living',
      name: 'Basic',
      seed: true,
      cloudBackupPending: false,
    })
    const { next, removeIds } = mergeCategoryPull([living, localNundo], [living])
    expect(next.map((row) => row.id)).toEqual(['seed:living'])
    expect(removeIds).toEqual(['seed:nundo'])
  })
})

describe('shouldApplyRemoteCategory', () => {
  it('applies remote changes when there is no unsynced local row', () => {
    expect(shouldApplyRemoteCategory(undefined)).toBe(true)
    expect(shouldApplyRemoteCategory(local({ id: 'a', name: 'A', cloudBackupPending: false }))).toBe(
      true,
    )
  })

  it('applies remote seed changes even if the local seed was never acked', () => {
    expect(
      shouldApplyRemoteCategory(local({ id: 'seed:living', name: 'Basic', seed: true })),
    ).toBe(true)
  })

  it('skips remote changes while a local custom upsert is still pending', () => {
    expect(shouldApplyRemoteCategory(local({ id: 'a', name: 'A', cloudBackupPending: true }))).toBe(
      false,
    )
  })
})

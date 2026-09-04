import { describe, expect, it } from 'vitest'
import {
  fromCloudCategoryId,
  perUserSeedCloudId,
  SEED_CLOUD_IDS,
  toCloudCategoryId,
} from './seedCategories'

const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('cloud seed category ids', () => {
  it('keeps custom category ids unchanged', () => {
    const custom = '7f1d3a2e-1111-4aaa-8bbb-cccccccccccccccc'
    expect(toCloudCategoryId(custom, userId)).toBe(custom)
    expect(fromCloudCategoryId(custom, userId)).toBe(custom)
  })

  it('reuses legacy seed uuids when this account already owns them', () => {
    const owned = new Set([SEED_CLOUD_IDS['seed:living']])
    expect(toCloudCategoryId('seed:living', userId, owned)).toBe(SEED_CLOUD_IDS['seed:living'])
    expect(fromCloudCategoryId(SEED_CLOUD_IDS['seed:shadow'])).toBe('seed:shadow')
  })

  it('derives a per-user seed uuid so a second account does not collide', () => {
    const cloudId = toCloudCategoryId('seed:living', userId, new Set())
    expect(cloudId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-000000000001')
    expect(cloudId).not.toBe(SEED_CLOUD_IDS['seed:living'])
    expect(fromCloudCategoryId(cloudId, userId)).toBe('seed:living')
    expect(perUserSeedCloudId(userId, 'seed:nundo')).toBe(
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000008',
    )
  })

  it('maps unnamed seed rows back by display name', () => {
    expect(
      fromCloudCategoryId('99999999-0000-4000-8000-000000000099', userId, {
        seed: true,
        name: 'Shadow',
      }),
    ).toBe('seed:shadow')
  })

  it('maps legacy empty-tag seed names to the Basic track', () => {
    expect(
      fromCloudCategoryId('99999999-0000-4000-8000-000000000099', userId, {
        seed: true,
        name: 'Living',
      }),
    ).toBe('seed:living')
    expect(
      fromCloudCategoryId('99999999-0000-4000-8000-000000000099', userId, {
        seed: true,
        name: 'Pokémon',
      }),
    ).toBe('seed:living')
    expect(
      fromCloudCategoryId('99999999-0000-4000-8000-000000000099', userId, {
        seed: true,
        name: 'Basic',
      }),
    ).toBe('seed:living')
  })
})

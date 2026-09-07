import { describe, expect, it } from 'vitest'
import { planCloudPhotoRestore, planGalleryRestore } from './restorePlan'

describe('planGalleryRestore', () => {
  const cloud = new Map([
    ['aaa', { id: 'spec-1' }],
    ['bbb', { id: 'spec-2' }],
  ])

  it('restores hashes that exist in cloud and not locally', () => {
    const plan = planGalleryRestore(['aaa', 'zzz'], cloud, new Set())
    expect(plan.restoreIds).toEqual(['spec-1'])
    expect(plan.unmatchedHashes).toEqual(['zzz'])
    expect(plan.alreadyLocalHashes).toEqual([])
  })

  it('skips photos already on the device', () => {
    const plan = planGalleryRestore(['aaa'], cloud, new Set(['aaa']))
    expect(plan.restoreIds).toEqual([])
    expect(plan.alreadyLocalHashes).toEqual(['aaa'])
  })

  it('does not restore the same cloud specimen twice', () => {
    const plan = planGalleryRestore(['aaa', 'aaa'], cloud, new Set())
    expect(plan.restoreIds).toEqual(['spec-1'])
    expect(plan.alreadyLocalHashes).toEqual(['aaa'])
  })
})

describe('planCloudPhotoRestore', () => {
  it('downloads cloud photos that are not on this device', () => {
    const plan = planCloudPhotoRestore(
      [
        { id: 'a', fileHash: 'h1', imagePath: 'u/h1.jpg' },
        { id: 'b', fileHash: 'h2', imagePath: 'u/h2.jpg' },
        { id: 'c', fileHash: 'h3', imagePath: null },
      ],
      new Set(['h1']),
    )
    expect(plan.download).toEqual([{ id: 'b', imagePath: 'u/h2.jpg' }])
    expect(plan.alreadyLocal).toBe(1)
    expect(plan.missingPhoto).toBe(1)
  })
})

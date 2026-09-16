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

  it('sends every photo to Transfer when cloud metadata is empty', () => {
    const plan = planGalleryRestore(['aaa', 'bbb', 'aaa'], new Map(), new Set())
    expect(plan.restoreIds).toEqual([])
    expect(plan.unmatchedHashes).toEqual(['aaa', 'bbb', 'aaa'])
    expect(plan.alreadyLocalHashes).toEqual([])
  })

  it('keeps one restore id per cloud specimen across a large pick', () => {
    const bigCloud = new Map(Array.from({ length: 1000 }, (_, i) => [`h${i}`, { id: `s${i}` }]))
    const hashes = Array.from({ length: 1000 }, (_, i) => `h${i}`)
    const plan = planGalleryRestore(hashes, bigCloud, new Set())
    expect(plan.restoreIds).toHaveLength(1000)
    expect(plan.unmatchedHashes).toEqual([])
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

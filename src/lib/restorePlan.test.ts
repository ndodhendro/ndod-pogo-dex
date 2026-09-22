import { describe, expect, it } from 'vitest'
import { planCloudPhotoRestore, planGalleryRestore, planRestoreInbox } from './restorePlan'

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

describe('planRestoreInbox', () => {
  it('skips unmatched photos whose filename is already in Untagged', () => {
    const plan = planRestoreInbox(
      [
        { hash: 'h1', fileName: 'Screenshot_1.png' },
        { hash: 'h2', fileName: 'new.webp' },
        { hash: 'h3', fileName: 'C:\\Pictures\\SCREENSHOT_1.PNG' },
      ],
      new Set(['screenshot_1.png']),
    )
    expect(plan.ingest).toEqual([{ hash: 'h2', fileName: 'new.webp' }])
    expect(plan.skipped.map((row) => row.hash)).toEqual(['h1', 'h3'])
  })

  it('keeps one copy of a repeated unmatched hash', () => {
    const plan = planRestoreInbox(
      [
        { hash: 'h1', fileName: 'a.png' },
        { hash: 'h1', fileName: 'a.png' },
        { hash: 'h2', fileName: 'b.png' },
      ],
      new Set(),
    )
    expect(plan.ingest.map((row) => row.hash)).toEqual(['h1', 'h2'])
    expect(plan.skipped).toEqual([])
  })

  it('keeps one unmatched photo per filename in the same restore', () => {
    const plan = planRestoreInbox(
      [
        { hash: 'h1', fileName: 'shot.png' },
        { hash: 'h2', fileName: 'SHOT.PNG' },
      ],
      new Set(),
    )
    expect(plan.ingest).toEqual([{ hash: 'h1', fileName: 'shot.png' }])
    expect(plan.skipped).toEqual([{ hash: 'h2', fileName: 'SHOT.PNG' }])
  })

  it('still sends unnamed photos to Transfer', () => {
    const plan = planRestoreInbox([{ hash: 'h1', fileName: null }], new Set(['shot.png']))
    expect(plan.ingest).toEqual([{ hash: 'h1', fileName: null }])
    expect(plan.skipped).toEqual([])
  })
})

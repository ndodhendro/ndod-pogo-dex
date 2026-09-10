import { describe, expect, it } from 'vitest'
import { GO_LUCKY_IDS, GO_RELEASED_IDS, GO_UNTRADABLE_IDS, isGoReleased } from './goReleased'

describe('GO released list', () => {
  it('covers Kanto starters and excludes unreleased mythicals', () => {
    expect(GO_RELEASED_IDS.size).toBeGreaterThan(900)
    expect(isGoReleased(1)).toBe(true)
    expect(isGoReleased(25)).toBe(true)
    expect(isGoReleased(808)).toBe(true)
    expect(isGoReleased(1025)).toBe(false)
    expect(isGoReleased(489)).toBe(false)
  })
})

describe('GO Lucky list', () => {
  it('is the released list minus wiki Untradable species', () => {
    expect([...GO_UNTRADABLE_IDS]).toEqual([
      151, 251, 385, 386, 491, 492, 494, 647, 648, 649, 718, 719, 720, 721, 802, 807, 890, 893,
    ])
    expect(GO_UNTRADABLE_IDS.size).toBe(18)
    for (const id of GO_UNTRADABLE_IDS) {
      expect(GO_RELEASED_IDS.has(id)).toBe(true)
      expect(GO_LUCKY_IDS.has(id)).toBe(false)
    }
    expect(GO_LUCKY_IDS.size).toBe(GO_RELEASED_IDS.size - GO_UNTRADABLE_IDS.size)
    expect(GO_LUCKY_IDS.size).toBe(938)
    expect(GO_LUCKY_IDS.has(1)).toBe(true)
    expect(GO_LUCKY_IDS.has(25)).toBe(true)
    expect(GO_LUCKY_IDS.has(808)).toBe(true)
    expect(GO_LUCKY_IDS.has(809)).toBe(true)
    expect(GO_LUCKY_IDS.has(151)).toBe(false)
    expect(GO_LUCKY_IDS.has(251)).toBe(false)
    expect(GO_LUCKY_IDS.has(494)).toBe(false)
    expect(GO_LUCKY_IDS.has(1025)).toBe(false)
  })
})

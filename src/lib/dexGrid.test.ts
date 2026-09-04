import { describe, expect, it } from 'vitest'
import { dexGridLayout } from './dexGrid'

describe('dexGridLayout', () => {
  it('does not collapse rows when the host width is 0 or missing', () => {
    const collapsed = dexGridLayout(0)
    expect(collapsed.columns).toBe(3)
    expect(collapsed.cardWidth).toBeGreaterThan(100)
    expect(collapsed.rowHeight).toBeGreaterThan(150)
    expect(dexGridLayout(-20)).toEqual(collapsed)
  })

  it('keeps three columns on a typical phone width', () => {
    const layout = dexGridLayout(360)
    expect(layout.columns).toBe(3)
    expect(layout.rowHeight).toBeGreaterThan(layout.cardWidth)
  })

  it('adds columns on a wide host', () => {
    expect(dexGridLayout(800).columns).toBeGreaterThan(3)
    expect(dexGridLayout(800).columns).toBeLessThanOrEqual(6)
  })
})

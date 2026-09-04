import { describe, expect, it } from 'vitest'
import {
  categoryOrderPatch,
  insertCategoryIdAt,
  moveCategoryId,
  sameCategoryOrder,
} from './categoryOrder'

describe('category order', () => {
  it('assigns sortOrder from the given list', () => {
    expect(categoryOrderPatch(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })

  it('rejects a partial or unknown list', () => {
    expect(() => categoryOrderPatch(['a', 'b'], ['a'])).toThrow('Category list is out of date')
    expect(() => categoryOrderPatch(['a', 'b'], ['a', 'x'])).toThrow('Category list is out of date')
    expect(() => categoryOrderPatch(['a', 'b'], ['a', 'a'])).toThrow('Category list is out of date')
  })

  it('moves a category by one slot', () => {
    expect(moveCategoryId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moveCategoryId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveCategoryId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })

  it('inserts a dragged category at a target index', () => {
    expect(insertCategoryIdAt(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
    expect(insertCategoryIdAt(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(insertCategoryIdAt(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  })

  it('detects an unchanged order', () => {
    expect(sameCategoryOrder(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameCategoryOrder(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

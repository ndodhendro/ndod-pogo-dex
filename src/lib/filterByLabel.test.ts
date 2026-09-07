import { describe, expect, it } from 'vitest'
import { filterByLabel } from './filterByLabel'

describe('filterByLabel', () => {
  const tracks = [
    { id: 'basic', label: 'Basic' },
    { id: 'shiny', label: 'Shiny' },
    { id: 'shadow', label: 'Shadow' },
    { id: 'costume', label: 'Costume' },
  ]

  it('keeps the original order when the query is empty', () => {
    expect(filterByLabel(tracks, '  ')).toEqual(tracks)
  })

  it('filters by label and keeps sort_order among matches', () => {
    expect(filterByLabel(tracks, 'sh')).toEqual([
      { id: 'shiny', label: 'Shiny' },
      { id: 'shadow', label: 'Shadow' },
    ])
  })
})

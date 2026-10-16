import { afterEach, describe, expect, it } from 'vitest'
import {
  emptyDexViewState,
  readDexViewState,
  resetDexViewState,
  writeDexViewState,
} from './dexViewState'

afterEach(() => {
  resetDexViewState()
})

describe('dexViewState', () => {
  it('returns empty filters for a category that has not been visited', () => {
    expect(readDexViewState('shadow')).toEqual(emptyDexViewState())
    expect(readDexViewState(undefined)).toEqual(emptyDexViewState())
  })

  it('restores the filters that were last written for that category', () => {
    writeDexViewState('shadow', {
      query: 'Pika',
      filterTags: ['shiny', 'costume'],
      progressFilter: 'caught',
      generationFilters: [
        { generationId: 1, kind: 'uncaught' },
        { generationId: 4, kind: 'pure' },
      ],
      showEvolutionLine: true,
    })

    expect(readDexViewState('shadow')).toEqual({
      query: 'Pika',
      filterTags: ['shiny', 'costume'],
      progressFilter: 'caught',
      generationFilters: [
        { generationId: 1, kind: 'uncaught' },
        { generationId: 4, kind: 'pure' },
      ],
      showEvolutionLine: true,
    })
    expect(readDexViewState('basic')).toEqual(emptyDexViewState())
  })

  it('keeps an Uncaught progress filter', () => {
    writeDexViewState('basic', {
      query: '',
      filterTags: [],
      progressFilter: 'uncaught',
      generationFilters: [],
      showEvolutionLine: false,
    })
    expect(readDexViewState('basic').progressFilter).toBe('uncaught')
  })

  it('keeps one progress filter per known generation', () => {
    writeDexViewState('basic', {
      query: '',
      filterTags: [],
      progressFilter: null,
      generationFilters: [
        { generationId: 1, kind: 'caught' },
        { generationId: 1, kind: 'pure' },
        { generationId: 99, kind: 'seen' },
        { generationId: 8, kind: 'uncaught' },
      ],
      showEvolutionLine: false,
    })
    const first = readDexViewState('basic')
    expect(first.generationFilters).toEqual([
      { generationId: 1, kind: 'caught' },
      { generationId: 8, kind: 'uncaught' },
    ])
    first.generationFilters.push({ generationId: 2, kind: 'seen' })
    expect(readDexViewState('basic').generationFilters).toEqual([
      { generationId: 1, kind: 'caught' },
      { generationId: 8, kind: 'uncaught' },
    ])
  })

  it('does not share the stored tag array with callers', () => {
    writeDexViewState('shadow', {
      query: '',
      filterTags: ['shiny'],
      progressFilter: null,
      generationFilters: [],
      showEvolutionLine: false,
    })
    const first = readDexViewState('shadow')
    first.filterTags.push('hundo')
    expect(readDexViewState('shadow').filterTags).toEqual(['shiny'])
  })
})

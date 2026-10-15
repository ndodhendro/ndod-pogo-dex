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
      uncaughtGenerationIds: [1, 4],
      showEvolutionLine: true,
    })

    expect(readDexViewState('shadow')).toEqual({
      query: 'Pika',
      filterTags: ['shiny', 'costume'],
      progressFilter: 'caught',
      uncaughtGenerationIds: [1, 4],
      showEvolutionLine: true,
    })
    expect(readDexViewState('basic')).toEqual(emptyDexViewState())
  })

  it('keeps an Uncaught progress filter', () => {
    writeDexViewState('basic', {
      query: '',
      filterTags: [],
      progressFilter: 'uncaught',
      uncaughtGenerationIds: [],
      showEvolutionLine: false,
    })
    expect(readDexViewState('basic').progressFilter).toBe('uncaught')
  })

  it('keeps Uncaught filters for known generations only', () => {
    writeDexViewState('basic', {
      query: '',
      filterTags: [],
      progressFilter: null,
      uncaughtGenerationIds: [1, 1, 99, 8],
      showEvolutionLine: false,
    })
    const first = readDexViewState('basic')
    expect(first.uncaughtGenerationIds).toEqual([1, 8])
    first.uncaughtGenerationIds.push(2)
    expect(readDexViewState('basic').uncaughtGenerationIds).toEqual([1, 8])
  })

  it('does not share the stored tag array with callers', () => {
    writeDexViewState('shadow', {
      query: '',
      filterTags: ['shiny'],
      progressFilter: null,
      uncaughtGenerationIds: [],
      showEvolutionLine: false,
    })
    const first = readDexViewState('shadow')
    first.filterTags.push('hundo')
    expect(readDexViewState('shadow').filterTags).toEqual(['shiny'])
  })
})

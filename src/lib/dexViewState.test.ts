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
      showEvolutionLine: true,
    })

    expect(readDexViewState('shadow')).toEqual({
      query: 'Pika',
      filterTags: ['shiny', 'costume'],
      progressFilter: 'caught',
      showEvolutionLine: true,
    })
    expect(readDexViewState('basic')).toEqual(emptyDexViewState())
  })

  it('does not share the stored tag array with callers', () => {
    writeDexViewState('shadow', {
      query: '',
      filterTags: ['shiny'],
      progressFilter: null,
      showEvolutionLine: false,
    })
    const first = readDexViewState('shadow')
    first.filterTags.push('hundo')
    expect(readDexViewState('shadow').filterTags).toEqual(['shiny'])
  })
})

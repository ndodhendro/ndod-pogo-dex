import { GENERATION_IDS } from '../data/generations'
import {
  DEX_GRID_FILTER_KINDS,
  type DexProgressKind,
  type GenerationProgressFilter,
} from './dexGrid'
import type { TagId } from './tags'

export type DexViewState = {
  query: string
  filterTags: TagId[]
  progressFilter: DexProgressKind | null
  generationFilters: GenerationProgressFilter[]
  showEvolutionLine: boolean
}

const byCategory = new Map<string, DexViewState>()

export function emptyDexViewState(): DexViewState {
  return {
    query: '',
    filterTags: [],
    progressFilter: null,
    generationFilters: [],
    showEvolutionLine: false,
  }
}

export function readDexViewState(categoryId: string | undefined): DexViewState {
  if (!categoryId) return emptyDexViewState()
  const saved = byCategory.get(categoryId)
  if (!saved) return emptyDexViewState()
  return cloneDexViewState(saved)
}

export function writeDexViewState(categoryId: string | undefined, state: DexViewState) {
  if (!categoryId) return
  byCategory.set(categoryId, cloneDexViewState(state))
}

export function resetDexViewState() {
  byCategory.clear()
}

function cloneDexViewState(state: DexViewState): DexViewState {
  return {
    query: state.query,
    filterTags: [...state.filterTags],
    progressFilter: parseProgressFilter(state.progressFilter),
    generationFilters: parseGenerationFilters(state.generationFilters),
    showEvolutionLine: Boolean(state.showEvolutionLine),
  }
}

function parseProgressFilter(value: DexViewState['progressFilter']): DexProgressKind | null {
  return value != null && DEX_GRID_FILTER_KINDS.includes(value) ? value : null
}

function parseGenerationFilters(value: DexViewState['generationFilters']): GenerationProgressFilter[] {
  if (!Array.isArray(value)) return []
  const filters: GenerationProgressFilter[] = []
  for (const row of value) {
    if (!row || typeof row.generationId !== 'number' || typeof row.kind !== 'string') continue
    if (!GENERATION_IDS.includes(row.generationId) || filters.some((filter) => filter.generationId === row.generationId)) {
      continue
    }
    const kind = parseProgressFilter(row.kind)
    if (!kind) continue
    filters.push({ generationId: row.generationId, kind })
  }
  return filters
}

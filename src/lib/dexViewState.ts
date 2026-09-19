import { DEX_PROGRESS_KINDS, type DexProgressKind } from './dexGrid'
import type { TagId } from './tags'

export type DexViewState = {
  query: string
  filterTags: TagId[]
  progressFilter: DexProgressKind | null
  showEvolutionLine: boolean
}

const byCategory = new Map<string, DexViewState>()

export function emptyDexViewState(): DexViewState {
  return {
    query: '',
    filterTags: [],
    progressFilter: null,
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
    showEvolutionLine: Boolean(state.showEvolutionLine),
  }
}

function parseProgressFilter(value: DexViewState['progressFilter']): DexProgressKind | null {
  return value != null && DEX_PROGRESS_KINDS.includes(value) ? value : null
}

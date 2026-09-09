/** National Dex generation ranges. Hisui species (899–905) stay in Generation 8. */
export type Generation = {
  id: number
  name: string
  start: number
  end: number
  /** Dark-theme label color from the core-game title, not a TPC brand palette. */
  color: string
}

export type GenerationGroup<T extends { speciesId: number }> = {
  generation: Generation
  items: T[]
}

/**
 * TPC does not assign an official color to each generation.
 * These hues follow the most recognizable core-game title for that generation.
 */
export const GENERATIONS: readonly Generation[] = [
  { id: 1, name: 'Kanto', start: 1, end: 151, color: '#ff6b6b' },
  { id: 2, name: 'Johto', start: 152, end: 251, color: '#e8c547' },
  { id: 3, name: 'Hoenn', start: 252, end: 386, color: '#34d399' },
  { id: 4, name: 'Sinnoh', start: 387, end: 493, color: '#67e8f9' },
  { id: 5, name: 'Unova', start: 494, end: 649, color: '#e2e8f0' },
  { id: 6, name: 'Kalos', start: 650, end: 721, color: '#f9a8d4' },
  { id: 7, name: 'Alola', start: 722, end: 809, color: '#fb923c' },
  { id: 8, name: 'Galar', start: 810, end: 905, color: '#a78bfa' },
  { id: 9, name: 'Paldea', start: 906, end: 1025, color: '#fb7185' },
]

export const GENERATION_IDS = GENERATIONS.map((generation) => generation.id)

export function generationForSpeciesId(id: number): Generation | undefined {
  if (!Number.isInteger(id) || id < 1) return undefined
  return GENERATIONS.find((generation) => id >= generation.start && id <= generation.end)
}

export function groupByGeneration<T extends { speciesId: number }>(
  items: readonly T[],
): GenerationGroup<T>[] {
  const groups = GENERATIONS.map((generation) => ({
    generation,
    items: [] as T[],
  }))
  const byId = new Map(groups.map((group) => [group.generation.id, group]))
  for (const item of items) {
    const generation = generationForSpeciesId(item.speciesId)
    if (!generation) continue
    byId.get(generation.id)?.items.push(item)
  }
  return groups.filter((group) => group.items.length > 0)
}

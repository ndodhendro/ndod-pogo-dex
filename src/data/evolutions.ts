import evolutionsJson from './evolutions.json'

type EvolutionsFile = {
  families: number[][]
  stages: number[]
}

const data = evolutionsJson as EvolutionsFile

export const EVOLUTION_FAMILIES: readonly (readonly number[])[] = data.families

const FAMILY_BY_SPECIES = new Map<number, readonly number[]>()
for (const family of EVOLUTION_FAMILIES) {
  for (const speciesId of family) FAMILY_BY_SPECIES.set(speciesId, family)
}

export function evolutionLine(speciesId: number): readonly number[] {
  return FAMILY_BY_SPECIES.get(speciesId) ?? (Number.isInteger(speciesId) && speciesId > 0 ? [speciesId] : [])
}

export function evolutionStage(speciesId: number): number {
  return data.stages[speciesId] ?? 0
}

/**
 * Parent when the previous stage has more than one species.
 * Beautifly evolves from Silcoon, Dustox from Cascoon.
 */
const SPLIT_PARENT = new Map<number, number>([
  [267, 266],
  [269, 268],
])

/** Earlier stages on the path to this species, from the first stage of the line. */
export function priorEvolutions(speciesId: number): readonly number[] {
  if (evolutionStage(speciesId) <= 0) return []
  const line = evolutionLine(speciesId)
  const chain: number[] = []
  let cursor = speciesId
  const seen = new Set<number>()
  while (evolutionStage(cursor) > 0 && !seen.has(cursor)) {
    seen.add(cursor)
    const atPrevious = line.filter((id) => evolutionStage(id) === evolutionStage(cursor) - 1)
    const parent = atPrevious.length === 1 ? atPrevious[0] : SPLIT_PARENT.get(cursor)
    if (parent == null) break
    chain.push(parent)
    cursor = parent
  }
  return chain.reverse()
}

/** Stage, then the current dex slot order: national number, then variant name. */
export function compareByEvolutionLine(
  a: { speciesId: number; variant: string },
  b: { speciesId: number; variant: string },
): number {
  const byStage = evolutionStage(a.speciesId) - evolutionStage(b.speciesId)
  if (byStage !== 0) return byStage
  return a.speciesId - b.speciesId || a.variant.localeCompare(b.variant)
}

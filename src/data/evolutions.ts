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

/** Stage, then the current dex slot order: national number, then variant name. */
export function compareByEvolutionLine(
  a: { speciesId: number; variant: string },
  b: { speciesId: number; variant: string },
): number {
  const byStage = evolutionStage(a.speciesId) - evolutionStage(b.speciesId)
  if (byStage !== 0) return byStage
  return a.speciesId - b.speciesId || a.variant.localeCompare(b.variant)
}

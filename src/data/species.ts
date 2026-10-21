import { fuzzyBestScore, indexFuzzyText, speciesIdMatchesQuery } from '../lib/fuzzySearch'
import speciesJson from './species.json'

export type Species = {
  id: number
  slug: string
  name: string
}

export const SPECIES: Species[] = speciesJson
export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]))

for (const species of SPECIES) {
  indexFuzzyText(species.name)
  indexFuzzyText(species.slug)
}

export function searchSpecies(query: string): Species[] {
  const q = query.trim()
  if (!q) return SPECIES
  return SPECIES.flatMap((species, index) => {
    const textScore = fuzzyBestScore(q, [species.name, species.slug])
    const idScore = speciesIdMatchesQuery(species.id, q) ? 5_000 : null
    if (textScore == null && idScore == null) return []
    return [{ species, index, score: Math.max(textScore ?? 0, idScore ?? 0) }]
  })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.species)
}

export const COMMON_FORMS = ['Alolan', 'Galarian', 'Hisuian', 'Paldean', 'Mega']

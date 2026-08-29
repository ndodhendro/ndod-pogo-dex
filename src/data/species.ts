import speciesJson from './species.json'

export type Species = {
  id: number
  slug: string
  name: string
}

export const SPECIES: Species[] = speciesJson
export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]))

export function searchSpecies(query: string): Species[] {
  const q = query.trim().toLowerCase()
  if (!q) return SPECIES
  return SPECIES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.slug.includes(q) ||
      String(s.id) === q ||
      String(s.id).padStart(4, '0') === q.padStart(4, '0'),
  )
}

export const COMMON_FORMS = ['Alolan', 'Galarian', 'Hisuian', 'Paldean', 'Mega']

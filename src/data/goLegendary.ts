import goLegendaryJson from './goLegendary.json'

/** National dex species with PokeAPI `is_legendary`. Mythicals are not in this set. */
export const GO_LEGENDARY_IDS: ReadonlySet<number> = new Set(goLegendaryJson)

/**
 * Galarian Articuno, Zapdos, and Moltres share these numbers with the Kanto birds.
 * Daily Adventure Incense can roll 0/0/0, so Nundo still lists them.
 */
const NUNDO_WILD_LEGENDARY_IDS = new Set<number>([144, 145, 146])

export function isGoLegendary(speciesId: number) {
  return GO_LEGENDARY_IDS.has(speciesId)
}

/** Raid legendaries cannot be 0/0/0. Galarian birds can. */
export function nundoExcludesSpecies(speciesId: number) {
  return GO_LEGENDARY_IDS.has(speciesId) && !NUNDO_WILD_LEGENDARY_IDS.has(speciesId)
}

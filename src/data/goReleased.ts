import goReleasedJson from './goReleased.json'
import goUntradableJson from './goUntradable.json'

/** National dex numbers released in Pokémon GO (wiki List of Pokémon, `a=n` excluded). */
export const GO_RELEASED_IDS: ReadonlySet<number> = new Set(goReleasedJson)

/**
 * Species in wiki Category:Untradable Pokémon. They cannot be traded, so they
 * cannot become Lucky. Meltan and Melmetal are not in that category.
 */
export const GO_UNTRADABLE_IDS: ReadonlySet<number> = new Set(goUntradableJson)

/** Pokémon GO released species that can be traded (Basic minus Untradable). */
export const GO_LUCKY_IDS: ReadonlySet<number> = new Set(
  [...GO_RELEASED_IDS].filter((id) => !GO_UNTRADABLE_IDS.has(id)),
)

export function isGoReleased(speciesId: number) {
  return GO_RELEASED_IDS.has(speciesId)
}

import { GO_LUCKY_IDS } from './goReleased'
import goFormReleasedJson from './goFormReleased.json'

type FormVariant = { speciesId: number; variant: string }

type GoFormReleasedJson = {
  alolan: number[]
  galarian: number[]
  hisuian: number[]
  paldean: number[]
  gender: FormVariant[]
  mega: FormVariant[]
  gigantamax: number[]
  shiny: number[]
  dynamax: number[]
  shadow: number[]
  costume: FormVariant[]
  background: FormVariant[]
  'alternate-forme': FormVariant[]
}

const data = goFormReleasedJson as GoFormReleasedJson

export const GO_ALTERNATE_FORME: readonly FormVariant[] = data['alternate-forme']
export const GO_GENDER: readonly FormVariant[] = data.gender
export const GO_MEGA: readonly FormVariant[] = data.mega
export const GO_COSTUME: readonly FormVariant[] = data.costume
export const GO_BACKGROUND: readonly FormVariant[] = data.background

/** Regional form, Mega, Gigantamax, Dynamax, Shadow, Purified, Lucky, Shiny, Costume, Background, and unique Gender species from Pokémon GO wiki pages. */
export const GO_FORM_SPECIES_IDS = {
  alolan: new Set(data.alolan),
  galarian: new Set(data.galarian),
  hisuian: new Set(data.hisuian),
  paldean: new Set(data.paldean),
  gender: new Set(GO_GENDER.map((row) => row.speciesId)),
  mega: new Set(GO_MEGA.map((row) => row.speciesId)),
  gigantamax: new Set(data.gigantamax),
  shiny: new Set(data.shiny),
  dynamax: new Set(data.dynamax),
  shadow: new Set(data.shadow),
  costume: new Set(GO_COSTUME.map((row) => row.speciesId)),
  background: new Set(GO_BACKGROUND.map((row) => row.speciesId)),
} as const

export type GoFormSpeciesTag = keyof typeof GO_FORM_SPECIES_IDS

/** Display name on empty-variant (Basic) slots. Not an Alternate forme row. */
export const GO_BASIC_DEFAULT_FORME: Readonly<Record<number, string>> = {
  201: 'F',
}

export function basicDefaultForme(speciesId: number): string {
  return GO_BASIC_DEFAULT_FORME[speciesId] ?? ''
}

const GO_ALTERNATE_SPECIES_IDS: ReadonlySet<number> = new Set(
  GO_ALTERNATE_FORME.map((row) => row.speciesId),
)

const GO_ALTERNATE_KEYS: ReadonlySet<string> = new Set(
  GO_ALTERNATE_FORME.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`),
)

const GO_GENDER_KEYS: ReadonlySet<string> = new Set(
  GO_GENDER.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`),
)

const GO_MEGA_KEYS: ReadonlySet<string> = new Set(
  GO_MEGA.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`),
)

const GO_COSTUME_KEYS: ReadonlySet<string> = new Set(
  GO_COSTUME.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`),
)

const GO_BACKGROUND_KEYS: ReadonlySet<string> = new Set(
  GO_BACKGROUND.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`),
)

export function goFormSpeciesIds(tag: string): ReadonlySet<number> | null {
  if (tag === 'purified') return GO_FORM_SPECIES_IDS.shadow
  if (tag === 'lucky') return GO_LUCKY_IDS
  if (
    tag === 'alolan' ||
    tag === 'galarian' ||
    tag === 'hisuian' ||
    tag === 'paldean' ||
    tag === 'gender' ||
    tag === 'mega' ||
    tag === 'gigantamax' ||
    tag === 'shiny' ||
    tag === 'dynamax' ||
    tag === 'shadow'
  ) {
    return GO_FORM_SPECIES_IDS[tag]
  }
  return null
}

export function hasStaticFormList(tag: string): boolean {
  return Boolean(goFormSpeciesIds(tag)) || tag === 'alternate-forme' || tag === 'costume' || tag === 'background'
}

export function goAlternateFormeSpeciesIds(): ReadonlySet<number> {
  return GO_ALTERNATE_SPECIES_IDS
}

export function staticFormSlotCount(tag: string, variantSlots: boolean): number {
  if (tag === 'gender') {
    return variantSlots ? GO_GENDER.length : GO_FORM_SPECIES_IDS.gender.size
  }
  if (tag === 'mega') {
    return variantSlots ? GO_MEGA.length : GO_FORM_SPECIES_IDS.mega.size
  }
  if (tag === 'alternate-forme') {
    return variantSlots ? GO_ALTERNATE_FORME.length : GO_ALTERNATE_SPECIES_IDS.size
  }
  if (tag === 'costume') {
    return variantSlots ? GO_COSTUME.length : GO_FORM_SPECIES_IDS.costume.size
  }
  if (tag === 'background') {
    return variantSlots ? GO_BACKGROUND.length : GO_FORM_SPECIES_IDS.background.size
  }
  const species = goFormSpeciesIds(tag)
  if (species) return species.size
  return 0
}

export function isGoFormReleased(tag: string, speciesId: number, variant = ''): boolean {
  const v = variant.trim().toLowerCase()
  if (tag === 'gender') {
    if (!v) return GO_FORM_SPECIES_IDS.gender.has(speciesId)
    return GO_GENDER_KEYS.has(`${speciesId}:${v}`)
  }
  if (tag === 'mega') {
    if (!v) return GO_FORM_SPECIES_IDS.mega.has(speciesId)
    return GO_MEGA_KEYS.has(`${speciesId}:${v}`)
  }
  if (tag === 'alternate-forme') {
    if (!v) return GO_ALTERNATE_SPECIES_IDS.has(speciesId)
    return GO_ALTERNATE_KEYS.has(`${speciesId}:${v}`)
  }
  if (tag === 'costume') {
    if (!v) return GO_FORM_SPECIES_IDS.costume.has(speciesId)
    return GO_COSTUME_KEYS.has(`${speciesId}:${v}`)
  }
  if (tag === 'background') {
    if (!v) return GO_FORM_SPECIES_IDS.background.has(speciesId)
    return GO_BACKGROUND_KEYS.has(`${speciesId}:${v}`)
  }
  const species = goFormSpeciesIds(tag)
  if (species) return !v && species.has(speciesId)
  return false
}

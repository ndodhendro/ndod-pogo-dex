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

/** Species summary background while Mega Evolved. Not the Mega Evolution event souvenir. */
export const MEGA_EVOLVE_BACKGROUND = 'Mega Evolve'

function withMegaEvolveBackgrounds(rows: readonly FormVariant[]): FormVariant[] {
  const seen = new Set(rows.map((row) => `${row.speciesId}:${row.variant.trim().toLowerCase()}`))
  const extra: FormVariant[] = []
  const megaSpecies = [...new Set(GO_MEGA.map((row) => row.speciesId))].sort((a, b) => a - b)
  for (const speciesId of megaSpecies) {
    const key = `${speciesId}:${MEGA_EVOLVE_BACKGROUND.toLowerCase()}`
    if (seen.has(key)) continue
    extra.push({ speciesId, variant: MEGA_EVOLVE_BACKGROUND })
  }
  return [...rows, ...extra].sort(
    (a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant),
  )
}

export const GO_BACKGROUND: readonly FormVariant[] = withMegaEvolveBackgrounds(data.background)

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

const UNOWN_LETTERS = ['!', '?', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')] as const
const SPINDA_PATTERNS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Pattern ${n}`)
const BURMY_CLOAKS = ['Plant Cloak', 'Sandy Cloak', 'Trash Cloak'] as const
const SEAS = ['West Sea', 'East Sea'] as const
const SEASONS = ['Spring Form', 'Summer Form', 'Autumn Form', 'Winter Form'] as const
const INCARNATE = ['Incarnate Forme', 'Therian Forme'] as const
const FLOWERS = ['Red Flower', 'Blue Flower', 'Orange Flower', 'White Flower', 'Yellow Flower'] as const
const PUMPKABOO_SIZES = ['Small Variety', 'Medium Variety', 'Large Variety', 'Jumbo Variety'] as const
const TEA_FORMS = ['Phony Form', 'Antique Form'] as const
const HERO = ['Hero of Many Battles'] as const

/**
 * Full named-forme family per species. The name that is not on the wiki extra list
 * is the Basic slot label (Unown F, Toxtricity Amped Form). Families whose extras
 * are all listed (Tauros breeds, Rotom appliances) have no Basic forme suffix.
 */
export const GO_ALTERNATE_FORME_FAMILIES: Readonly<Record<number, readonly string[]>> = {
  201: UNOWN_LETTERS,
  327: SPINDA_PATTERNS,
  351: ['Normal', 'Rainy', 'Snowy', 'Sunny'],
  386: ['Normal Forme', 'Attack Forme', 'Defense Forme', 'Speed Forme'],
  412: BURMY_CLOAKS,
  413: BURMY_CLOAKS,
  421: ['Overcast Form', 'Sunshine Form'],
  422: SEAS,
  423: SEAS,
  483: ['Altered Forme', 'Origin Forme'],
  484: ['Altered Forme', 'Origin Forme'],
  487: ['Altered Forme', 'Origin Forme'],
  492: ['Land Forme', 'Sky Forme'],
  550: ['Red-Striped', 'Blue-Striped', 'White-Striped'],
  585: SEASONS,
  586: SEASONS,
  641: INCARNATE,
  642: INCARNATE,
  645: INCARNATE,
  647: ['Ordinary Form', 'Resolute Form'],
  669: FLOWERS,
  670: FLOWERS,
  671: FLOWERS,
  676: [
    'Natural Form',
    'Dandy Trim',
    'Debutante Trim',
    'Diamond Trim',
    'Heart Trim',
    'Kabuki Trim',
    'La Reine Trim',
    'Matron Trim',
    'Pharaoh Trim',
    'Star Trim',
  ],
  681: ['Shield Forme', 'Blade Forme'],
  710: PUMPKABOO_SIZES,
  711: PUMPKABOO_SIZES,
  716: ['Neutral Mode', 'Active Mode'],
  // Zygarde Basic is 10% Forme; 50% and Complete stay on Alternate forme.
  718: ['10% Forme', '50% Forme', 'Complete Forme'],
  720: ['Hoopa Confined', 'Hoopa Unbound'],
  741: ['Baile Style', "Pa'u Style", 'Pom-Pom Style', 'Sensu Style'],
  745: ['Midday Form', 'Midnight Form', 'Dusk Form'],
  778: ['Disguised Form', 'Busted Form'],
  849: ['Amped Form', 'Low Key Form'],
  854: TEA_FORMS,
  855: TEA_FORMS,
  877: ['Full Belly Mode', 'Hangry Mode'],
  888: [...HERO, 'Crowned Sword'],
  889: [...HERO, 'Crowned Shield'],
  892: ['Single Strike Style', 'Rapid Strike Style'],
  905: INCARNATE,
  925: ['Family of Four', 'Family of Three'],
  931: ['Green Plumage', 'Blue Plumage', 'White Plumage', 'Yellow Plumage'],
  978: ['Curly Form', 'Droopy Form', 'Stretchy Form'],
  982: ['Two-Segment Form', 'Three-Segment Form'],
  1012: ['Counterfeit Form', 'Artisan Form'],
  1013: ['Unremarkable Form', 'Masterpiece Form'],
}

/** Display name on empty-variant (Basic) slots. Not an Alternate forme row. */
export function basicDefaultForme(speciesId: number): string {
  const family = GO_ALTERNATE_FORME_FAMILIES[speciesId]
  if (!family) return ''
  const extras = new Set(
    GO_ALTERNATE_FORME.filter((row) => row.speciesId === speciesId).map((row) =>
      row.variant.trim().toLowerCase(),
    ),
  )
  const missing = family.filter((name) => !extras.has(name.trim().toLowerCase()))
  return missing.length === 1 ? missing[0] : ''
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

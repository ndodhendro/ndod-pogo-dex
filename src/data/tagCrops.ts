export const BASIC_CROP_TAG = 'basic'
/** Seen (silhouette) screenshots always crop here, regardless of other tags. */
export const SEEN_CROP_HEIGHT = 710

/** Crop bottom (Paint Y, exclusive) per tag. Basic is the empty-look chip. */
export const SEED_TAG_CROPS: { tag: string; height: number }[] = [
  { tag: 'basic', height: 710 },
  { tag: 'alolan', height: 710 },
  { tag: 'galarian', height: 710 },
  { tag: 'hisuian', height: 710 },
  { tag: 'paldean', height: 710 },
  { tag: 'mega', height: 1055 },
  { tag: 'gigantamax', height: 1055 },
  { tag: 'dynamax', height: 1055 },
  { tag: 'shadow', height: 710 },
  { tag: 'purified', height: 710 },
  { tag: 'lucky', height: 748 },
  { tag: 'costume', height: 710 },
  { tag: 'best-buddy', height: 710 },
  { tag: 'background', height: 710 },
  { tag: 'xxs', height: 930 },
  { tag: 'xxl', height: 930 },
  { tag: 'hundo', height: 710 },
  { tag: 'nundo', height: 710 },
  { tag: 'alternate-forme', height: 710 },
  { tag: 'gender', height: 710 },
  { tag: 'shiny', height: 710 },
  { tag: 'max-cp', height: 710 },
]

export const MAX_TAG_CROP_HEIGHT = Math.max(...SEED_TAG_CROPS.map((row) => row.height))

/**
 * Lucky is 38px taller than Basic (748 − 710). The same extra is the default
 * on size forms until a screenshot is measured on the crop page.
 */
export const LUCKY_CROP_EXTRA = 38

/** Both tags must be present. Stored under `tag` so the crop page can replace the default. */
export const SEED_COMBO_CROPS: { tag: string; tags: readonly string[]; height: number }[] = [
  { tag: 'lucky+mega', tags: ['lucky', 'mega'], height: 1055 + LUCKY_CROP_EXTRA },
  { tag: 'lucky+gigantamax', tags: ['lucky', 'gigantamax'], height: 1055 + LUCKY_CROP_EXTRA },
  { tag: 'lucky+dynamax', tags: ['lucky', 'dynamax'], height: 1055 + LUCKY_CROP_EXTRA },
  { tag: 'lucky+xxs', tags: ['lucky', 'xxs'], height: 930 + LUCKY_CROP_EXTRA },
  { tag: 'lucky+xxl', tags: ['lucky', 'xxl'], height: 930 + LUCKY_CROP_EXTRA },
]

const COMBO_CROP_TAGS = new Set(SEED_COMBO_CROPS.map((row) => row.tag))

export function isComboCropTag(tag: string): boolean {
  return COMBO_CROP_TAGS.has(tag)
}

export function matchingComboCrops(tags: readonly string[]) {
  const selected = new Set(tags)
  return SEED_COMBO_CROPS.filter((row) => row.tags.every((tag) => selected.has(tag)))
}

function storedHeight(
  tag: string,
  heights: Record<string, number>,
  fallback: number,
): number {
  const height = heights[tag]
  return typeof height === 'number' ? height : fallback
}

export const EXTRA_SPECIMEN_TAGS: {
  tag: string
  label: string
  icon: string
}[] = [
  { tag: 'dynamax', label: 'Dynamax', icon: '🟣' },
  { tag: 'gigantamax', label: 'Gigantamax', icon: '⭕' },
  { tag: 'lucky', label: 'Lucky', icon: '🍀' },
  { tag: 'best-buddy', label: 'Best buddy', icon: '🤝' },
  { tag: 'xxs', label: 'XXS', icon: '🔽' },
  { tag: 'xxl', label: 'XXL', icon: '🔼' },
  { tag: 'alternate-forme', label: 'Alternate forme', icon: '🔄' },
  { tag: 'gender', label: 'Gender', icon: '⚥' },
  { tag: 'max-cp', label: 'Max CP', icon: '📈' },
]

export const EXTRA_TAG_LABELS: Record<string, string> = Object.fromEntries(
  EXTRA_SPECIMEN_TAGS.map((row) => [row.tag, row.label]),
)

export function cropHeightForTags(
  tags: readonly string[],
  heights: Record<string, number>,
  fallback = 710,
): number {
  const keys = tags.length === 0 ? [BASIC_CROP_TAG] : tags
  const combos = matchingComboCrops(keys)
  const covered = new Set(combos.flatMap((combo) => combo.tags))
  let max = fallback
  let found = false
  const consider = (height: number) => {
    if (!found) {
      max = height
      found = true
    } else {
      max = Math.max(max, height)
    }
  }
  for (const tag of keys) {
    if (covered.has(tag)) continue
    const height = heights[tag]
    if (typeof height !== 'number') continue
    consider(height)
  }
  for (const combo of combos) {
    consider(storedHeight(combo.tag, heights, combo.height))
  }
  return max
}

/** Combo rows that supplied `height`, so a crop-page edit can replace those defaults. */
export function comboCropsAtHeight(
  tags: readonly string[],
  heights: Record<string, number>,
  height: number,
) {
  return matchingComboCrops(tags).filter(
    (combo) => storedHeight(combo.tag, heights, combo.height) === height,
  )
}

export function cropHeightForSpecimen(
  tags: readonly string[],
  heights: Record<string, number>,
  silhouette = false,
): number {
  if (silhouette) return SEEN_CROP_HEIGHT
  return cropHeightForTags(tags, heights)
}

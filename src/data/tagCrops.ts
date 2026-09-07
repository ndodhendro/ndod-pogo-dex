export const BASIC_CROP_TAG = 'basic'

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
  let max = fallback
  let found = false
  for (const tag of keys) {
    const height = heights[tag]
    if (typeof height !== 'number') continue
    if (!found) {
      max = height
      found = true
    } else {
      max = Math.max(max, height)
    }
  }
  return max
}

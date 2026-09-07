import { SCREENSHOT_WIDTH } from './images'
import { MAX_TAG_CROP_HEIGHT } from '../data/tagCrops'
import { hasAllRequired, specimenTags, type SpecimenFields, type TagId } from './tags'

/** Matches Dex grid: min card 112px, 8px gaps (`--space-2`), crop frame + label. */
export const DEX_COL_GAP = 8
export const DEX_MIN_COL = 112
export const DEX_MIN_COLUMNS = 3
export const DEX_MAX_COLUMNS = 6
export const DEX_LABEL_STACK = 36
export const DEX_ROW_GAP = 8

export function dexCardAspect(frameHeight = MAX_TAG_CROP_HEIGHT) {
  return frameHeight / SCREENSHOT_WIDTH
}

export const DEX_CARD_ASPECT = dexCardAspect()

export function dexGridLayout(width: number, frameHeight = MAX_TAG_CROP_HEIGHT) {
  const safeWidth = Math.max(width, DEX_MIN_COL * DEX_MIN_COLUMNS - DEX_COL_GAP)
  const columns = Math.max(
    DEX_MIN_COLUMNS,
    Math.min(DEX_MAX_COLUMNS, Math.floor((safeWidth + DEX_COL_GAP) / DEX_MIN_COL)),
  )
  const cardWidth = (safeWidth - (columns - 1) * DEX_COL_GAP) / columns
  const rowHeight = cardWidth * dexCardAspect(frameHeight) + DEX_LABEL_STACK + DEX_ROW_GAP
  return { columns, cardWidth, rowHeight }
}

/** Filled species vs catalog size, clamped to 0–100. */
export function dexCompletionPercent(filled: number, total: number): number {
  if (!Number.isFinite(filled) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, (filled / total) * 100))
}

export function formatDexCompletionPercent(filled: number, total: number): string {
  return `${dexCompletionPercent(filled, total).toFixed(2)}%`
}

/** Unique species with at least one specimen that satisfies the track. */
export function countFilledSpecies(
  specimens: readonly SpecimenFields[],
  required: readonly TagId[],
): number {
  const filled = new Set<number>()
  const tags = [...required]
  for (const specimen of specimens) {
    if (filled.has(specimen.speciesId)) continue
    if (hasAllRequired(specimenTags(specimen), tags)) filled.add(specimen.speciesId)
  }
  return filled.size
}

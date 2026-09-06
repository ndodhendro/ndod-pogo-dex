import { SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH } from './images'

/** Matches Dex grid: min card 112px, 8px gaps (`--space-2`), 738×1600 frame + label. */
export const DEX_COL_GAP = 8
export const DEX_MIN_COL = 112
export const DEX_MIN_COLUMNS = 3
export const DEX_MAX_COLUMNS = 6
export const DEX_LABEL_STACK = 22
export const DEX_ROW_GAP = 8
export const DEX_CARD_ASPECT = SCREENSHOT_HEIGHT / SCREENSHOT_WIDTH

export function dexGridLayout(width: number) {
  const safeWidth = Math.max(width, DEX_MIN_COL * DEX_MIN_COLUMNS - DEX_COL_GAP)
  const columns = Math.max(
    DEX_MIN_COLUMNS,
    Math.min(DEX_MAX_COLUMNS, Math.floor((safeWidth + DEX_COL_GAP) / DEX_MIN_COL)),
  )
  const cardWidth = (safeWidth - (columns - 1) * DEX_COL_GAP) / columns
  const rowHeight = cardWidth * DEX_CARD_ASPECT + DEX_LABEL_STACK + DEX_ROW_GAP
  return { columns, cardWidth, rowHeight }
}

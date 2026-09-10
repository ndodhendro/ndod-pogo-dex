import type { Generation } from '../data/generations'
import { MAX_TAG_CROP_HEIGHT } from '../data/tagCrops'
import { SCREENSHOT_WIDTH } from './images'
import { hasAllRequired, isSilhouette, specimenTags, type SpecimenFields, type TagId } from './tags'

/** Matches Dex grid: min card 112px, 8px gaps (`--space-2`), crop frame + label. */
export const DEX_COL_GAP = 8
export const DEX_MIN_COL = 112
export const DEX_MIN_COLUMNS = 3
export const DEX_MAX_COLUMNS = 6
export const DEX_LABEL_STACK = 36
export const DEX_ROW_GAP = 8
export const DEX_GEN_HEADER_HEIGHT = 44
export const DEX_GEN_SECTION_GAP = 16
export const DEX_SECTION_ANIM_MS = 240

export type DexVirtualRow<T> =
  | { kind: 'header'; key: string; generation: Generation; lead: boolean }
  | {
      kind: 'cards'
      key: string
      generationId: number
      rowIndex: number
      rowCount: number
      slots: T[]
    }

export function dexGenHeaderHeight(lead: boolean) {
  return lead ? DEX_GEN_HEADER_HEIGHT : DEX_GEN_HEADER_HEIGHT + DEX_GEN_SECTION_GAP
}

export function dexOpenAmount(
  generationId: number,
  collapsed: ReadonlySet<number>,
  amounts: ReadonlyMap<number, number>,
): number {
  const amount = amounts.get(generationId)
  if (typeof amount === 'number') return amount
  return collapsed.has(generationId) ? 0 : 1
}

/** Generations whose card rows can leave the virtual list (fully closed). */
export function hiddenDexGenerations(
  collapsed: ReadonlySet<number>,
  amounts: ReadonlyMap<number, number>,
): ReadonlySet<number> {
  const hidden = new Set<number>()
  for (const id of collapsed) {
    if (dexOpenAmount(id, collapsed, amounts) <= 0) hidden.add(id)
  }
  return hidden
}

export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

export function interpolateOpenAmount(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(t)
}

/** Clip a generation from the bottom as it opens or closes. */
export function dexAnimatedCardRowHeight(
  rowIndex: number,
  rowCount: number,
  rowHeight: number,
  openAmount: number,
): number {
  if (rowCount <= 0 || rowHeight <= 0 || openAmount <= 0) return 0
  if (openAmount >= 1) return rowHeight
  const visible = rowCount * rowHeight * openAmount
  const start = rowIndex * rowHeight
  if (visible <= start) return 0
  if (visible >= start + rowHeight) return rowHeight
  return visible - start
}

export function buildDexVirtualRows<T extends { speciesId: number }>(
  groups: readonly { generation: Generation; items: readonly T[] }[],
  columns: number,
  collapsed: ReadonlySet<number>,
  open?: { amounts: ReadonlyMap<number, number>; rowHeight: number },
): DexVirtualRow<T>[] {
  const cols = Math.max(1, columns)
  const amounts = open?.amounts ?? new Map<number, number>()
  const rows: DexVirtualRow<T>[] = []
  for (const group of groups) {
    rows.push({
      kind: 'header',
      key: `h-${group.generation.id}`,
      generation: group.generation,
      lead: rows.length === 0,
    })
    const amount = dexOpenAmount(group.generation.id, collapsed, amounts)
    if (amount <= 0) continue
    const rowCount = Math.ceil(group.items.length / cols)
    let rowIndex = 0
    for (let i = 0; i < group.items.length; i += cols) {
      const size = open
        ? dexAnimatedCardRowHeight(rowIndex, rowCount, open.rowHeight, amount)
        : 1
      if (size > 0) {
        rows.push({
          kind: 'cards',
          key: `c-${group.generation.id}-${i}`,
          generationId: group.generation.id,
          rowIndex,
          rowCount,
          slots: group.items.slice(i, i + cols),
        })
      }
      rowIndex += 1
    }
  }
  return rows
}

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

export const DEX_PROGRESS_KINDS = ['seen', 'caught', 'pure'] as const
export type DexProgressKind = (typeof DEX_PROGRESS_KINDS)[number]

export type DexProgressLayer = {
  kind: DexProgressKind
  current: number
  percent: number
}

/** Highest fill first (back of the bar). Ties keep Seen, then Caught, then Pure. */
export function stackDexProgressLayers(
  counts: Record<DexProgressKind, number>,
  total: number,
): DexProgressLayer[] {
  return DEX_PROGRESS_KINDS.map((kind) => ({
    kind,
    current: counts[kind],
    percent: dexCompletionPercent(counts[kind], total),
  })).sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent
    return DEX_PROGRESS_KINDS.indexOf(a.kind) - DEX_PROGRESS_KINDS.indexOf(b.kind)
  })
}

/** Unique species with at least one specimen that satisfies the track. */
export function countFilledSpecies(
  specimens: readonly SpecimenFields[],
  required: readonly TagId[],
): number {
  const filled = new Set<number>()
  const tags = [...required]
  for (const specimen of specimens) {
    if (isSilhouette(specimen) || filled.has(specimen.speciesId)) continue
    if (hasAllRequired(specimenTags(specimen), tags)) filled.add(specimen.speciesId)
  }
  return filled.size
}

export function pickDexCover<T extends { id: string; silhouette?: boolean }>(
  group: readonly T[],
  coverId: string | undefined,
  silhouetteOnly = false,
): T | undefined {
  if (silhouetteOnly) {
    const silhouettes = group.filter(isSilhouette)
    if (silhouettes.length === 0) return undefined
    return silhouettes.find((row) => row.id === coverId) ?? silhouettes[0]
  }
  if (group.length === 0) return undefined
  return group.find((row) => row.id === coverId) ?? group[0]
}

export function keepDexSlot(hasMatch: boolean, filtering: boolean): boolean {
  return !filtering || hasMatch
}

export function specimenMatchesDexFilters(
  specimen: SpecimenFields,
  filterTags: readonly TagId[] = [],
  silhouetteOnly = false,
): boolean {
  if (silhouetteOnly && !isSilhouette(specimen)) return false
  return hasAllRequired(specimenTags(specimen), [...filterTags])
}

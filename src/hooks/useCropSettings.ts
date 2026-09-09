import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cropHeightForTags, MAX_TAG_CROP_HEIGHT, SEED_TAG_CROPS } from '../data/tagCrops'
import { db } from '../lib/db'

const SEED_CROP_HEIGHTS = Object.fromEntries(SEED_TAG_CROPS.map((row) => [row.tag, row.height]))

export function useTagCropHeights(): Record<string, number> {
  const rows = useLiveQuery(() => db.tagCrops.toArray(), []) ?? []
  return useMemo(
    () => Object.fromEntries(rows.map((row) => [row.tag, row.height])),
    [rows],
  )
}

export function useFrameHeight() {
  const heights = useTagCropHeights()
  const values = Object.values(heights)
  if (values.length === 0) return MAX_TAG_CROP_HEIGHT
  return Math.max(...values)
}

/** Dex grid frame follows the open track’s required tags, not the tallest crop in the catalog. */
export function useTrackFrameHeight(requiredTags: readonly string[]) {
  const stored = useTagCropHeights()
  return cropHeightForTags(requiredTags, { ...SEED_CROP_HEIGHTS, ...stored })
}

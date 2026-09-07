import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MAX_TAG_CROP_HEIGHT } from '../data/tagCrops'
import { db } from '../lib/db'

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

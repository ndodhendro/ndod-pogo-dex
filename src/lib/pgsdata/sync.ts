import { rebuildFeeds, dumpFeedsJson, parseFeedsJson, type FeedRebuildStats, type PgsFeed } from './feeds'
import { HLFEEDS_KEY, packJavaHashMap, parseJavaHashMap, type HashMapPayload } from './javaHashMap'
import type { CategoryRow, SpecimenRow, TagCatalogRow, TagRosterRow } from '../db'

export type PgsDataFile = {
  payload: HashMapPayload
  feeds: PgsFeed[]
}

export type PgsDataPackResult = {
  bytes: Uint8Array
  feeds: PgsFeed[]
}

export function extractFeeds(payload: HashMapPayload): PgsFeed[] {
  const raw = payload.entries[HLFEEDS_KEY]
  if (!raw || raw.type !== 'string') throw new Error('PGSData.dat has no nearby feeds')
  return parseFeedsJson(raw.value)
}

export function setFeeds(payload: HashMapPayload, feeds: PgsFeed[]): HashMapPayload {
  return {
    ...payload,
    entries: {
      ...payload.entries,
      [HLFEEDS_KEY]: { type: 'string', value: dumpFeedsJson(feeds) },
    },
  }
}

export function openPgsData(data: Uint8Array): PgsDataFile {
  const payload = parseJavaHashMap(data)
  return { payload, feeds: extractFeeds(payload) }
}

export function fillPgsFeeds(
  feeds: PgsFeed[],
  specimens: readonly SpecimenRow[],
  categories: readonly CategoryRow[],
  catalogs: readonly TagCatalogRow[] = [],
  roster: readonly TagRosterRow[] = [],
): { feeds: PgsFeed[]; stats: FeedRebuildStats } {
  return rebuildFeeds(feeds, specimens, categories, catalogs, roster)
}

export function packPgsData(payload: HashMapPayload, feeds: PgsFeed[]): PgsDataPackResult {
  const packed = packJavaHashMap(setFeeds(payload, feeds))
  const verify = extractFeeds(parseJavaHashMap(packed))
  if (JSON.stringify(verify) !== JSON.stringify(feeds)) {
    throw new Error('Could not pack PGSData.dat')
  }
  return { bytes: packed, feeds }
}

export function downloadBytes(filename: string, bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

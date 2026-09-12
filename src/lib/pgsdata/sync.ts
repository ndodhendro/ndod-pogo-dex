import {
  countAdded,
  countRemoved,
  dumpFeedsJson,
  parseFeedsJson,
  syncFeeds,
  type FeedSyncChange,
  type PgsFeed,
} from './feeds'
import { HLFEEDS_KEY, packJavaHashMap, parseJavaHashMap, type HashMapPayload } from './javaHashMap'
import type { CategoryRow, SpecimenRow, TagCatalogRow, TagRosterRow } from '../db'

export type PgsDataSyncResult = {
  bytes: Uint8Array
  feeds: PgsFeed[]
  changes: FeedSyncChange[]
  removed: number
  added: number
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

export function syncPgsData(
  data: Uint8Array,
  specimens: readonly SpecimenRow[],
  categories: readonly CategoryRow[],
  catalogs: readonly TagCatalogRow[] = [],
  roster: readonly TagRosterRow[] = [],
): PgsDataSyncResult {
  const payload = parseJavaHashMap(data)
  const feeds = extractFeeds(payload)
  const synced = syncFeeds(feeds, specimens, categories, catalogs, roster)
  const packed = packJavaHashMap(setFeeds(payload, synced.feeds))
  const verify = extractFeeds(parseJavaHashMap(packed))
  if (JSON.stringify(verify) !== JSON.stringify(synced.feeds)) {
    throw new Error('Could not repack PGSData.dat')
  }
  return {
    bytes: packed,
    feeds: synced.feeds,
    changes: synced.changes,
    removed: countRemoved(synced.changes),
    added: countAdded(synced.changes),
  }
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

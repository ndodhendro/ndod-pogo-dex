import { screenshotFileName } from './screenshotFileName'

export type InboxSortDir = 'asc' | 'desc'

export const INBOX_SORT_EMOJI: Record<InboxSortDir, string> = {
  asc: '🔼',
  desc: '🔽',
}

export const INBOX_SORT_LABEL: Record<InboxSortDir, string> = {
  asc: 'A–Z',
  desc: 'Z–A',
}

type InboxSortable = {
  id: string
  fileName?: string | null
  createdAt: number
}

export function inboxOrderIds<T extends { id: string }>(rows: readonly T[]) {
  return rows.map((row) => row.id)
}

export function sameInboxOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function sortInboxByFileName<T extends InboxSortable>(
  rows: readonly T[],
  dir: InboxSortDir,
): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = a.fileName ?? ''
    const right = b.fileName ?? ''
    const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    if (cmp !== 0) return sign * cmp
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
    return a.id.localeCompare(b.id)
  })
}

export function inboxMatchesFileNameQuery(
  fileName: string | null | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = screenshotFileName(fileName)
  return Boolean(name && name.toLowerCase().includes(q))
}

/** Keep the user's last order; newly added rows stay in live (newest-first) order at the top. */
export function mergeInboxDisplay<T extends { id: string }>(
  live: readonly T[],
  orderIds: readonly string[],
): T[] {
  if (orderIds.length === 0) return [...live]
  const byId = new Map(live.map((row) => [row.id, row]))
  const liveIds = new Set(live.map((row) => row.id))
  const kept = orderIds.filter((id) => liveIds.has(id))
  const keptSet = new Set(kept)
  const incoming = live.filter((row) => !keptSet.has(row.id))
  return [
    ...incoming,
    ...kept.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    }),
  ]
}

/** Apply the current filename sort, or toggle direction when the list is already sorted that way. */
export function nextInboxSort<T extends InboxSortable>(
  displayed: readonly T[],
  dir: InboxSortDir,
): { dir: InboxSortDir; ids: string[] } {
  const applied = sortInboxByFileName(displayed, dir)
  if (!sameInboxOrder(inboxOrderIds(displayed), inboxOrderIds(applied))) {
    return { dir, ids: inboxOrderIds(applied) }
  }
  const nextDir: InboxSortDir = dir === 'asc' ? 'desc' : 'asc'
  return { dir: nextDir, ids: inboxOrderIds(sortInboxByFileName(displayed, nextDir)) }
}

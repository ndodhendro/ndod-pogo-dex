import { fuzzyMatches } from './fuzzySearch'

export function filterByLabel<T extends { label: string }>(items: T[], query: string): T[] {
  const q = query.trim()
  if (!q) return items
  return items.filter((item) => fuzzyMatches(q, item.label))
}

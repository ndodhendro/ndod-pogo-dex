export function filterByLabel<T extends { label: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => item.label.toLowerCase().includes(q))
}

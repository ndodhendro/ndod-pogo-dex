import { extraTagList, type SpecimenFields } from './tags'

export function isSpecimenFileHashConflict(error: {
  code?: string | null
  message?: string | null
} | null): boolean {
  if (!error) return false
  if (error.code === '23505' && error.message?.includes('specimens_user_file_hash')) return true
  return Boolean(error.message?.includes('specimens_user_file_hash'))
}

export function cloudBackupErrorMessage(message: string): string {
  if (message.includes('specimens_user_file_hash')) {
    return 'Screenshot already in the collection'
  }
  return message
}

export function sameSpecimenMetadata(a: SpecimenFields, b: SpecimenFields): boolean {
  const extraA = extraTagList(a)
  const extraB = extraTagList(b)
  return (
    a.speciesId === b.speciesId &&
    (a.form ?? null) === (b.form ?? null) &&
    a.shiny === b.shiny &&
    a.shadowStatus === b.shadowStatus &&
    (a.costume ?? null) === (b.costume ?? null) &&
    (a.background ?? null) === (b.background ?? null) &&
    a.hundo === b.hundo &&
    a.nundo === b.nundo &&
    extraA.length === extraB.length &&
    extraA.every((tag, i) => tag === extraB[i])
  )
}

export function pickSpecimenToKeepForHash<
  T extends { id: string; createdAt: number; cloudBackupPending?: boolean },
>(rows: T[]): T {
  const backedUp = rows.filter((row) => row.cloudBackupPending === false)
  const pool = backedUp.length > 0 ? backedUp : rows
  return pool.reduce((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? a : b
    return a.id < b.id ? a : b
  })
}

export function partitionDuplicateFileHashes<T extends { id: string; fileHash: string; createdAt: number; cloudBackupPending?: boolean }>(
  rows: T[],
): { keep: T[]; extras: Array<{ extra: T; keep: T }> } {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const list = groups.get(row.fileHash) ?? []
    list.push(row)
    groups.set(row.fileHash, list)
  }
  const keep: T[] = []
  const extras: Array<{ extra: T; keep: T }> = []
  for (const list of groups.values()) {
    const chosen = pickSpecimenToKeepForHash(list)
    keep.push(chosen)
    for (const row of list) {
      if (row.id !== chosen.id) extras.push({ extra: row, keep: chosen })
    }
  }
  return { keep, extras }
}

export function dedupePayloadByFileHash<T extends { file_hash: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (seen.has(row.file_hash)) continue
    seen.add(row.file_hash)
    out.push(row)
  }
  return out
}

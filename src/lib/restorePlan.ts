export type RestorePlan = {
  restoreIds: string[]
  unmatchedHashes: string[]
  alreadyLocalHashes: string[]
}

export function planGalleryRestore(
  fileHashes: string[],
  cloudByHash: Map<string, { id: string }>,
  localHashes: Set<string>,
): RestorePlan {
  const restoreIds: string[] = []
  const unmatchedHashes: string[] = []
  const alreadyLocalHashes: string[] = []
  const claimed = new Set<string>()

  for (const hash of fileHashes) {
    const cloud = cloudByHash.get(hash)
    if (!cloud) {
      unmatchedHashes.push(hash)
      continue
    }
    if (localHashes.has(hash) || claimed.has(cloud.id)) {
      alreadyLocalHashes.push(hash)
      continue
    }
    claimed.add(cloud.id)
    restoreIds.push(cloud.id)
  }

  return { restoreIds, unmatchedHashes, alreadyLocalHashes }
}

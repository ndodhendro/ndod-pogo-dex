import { db, type SpecimenRow } from './db'

export async function rebaseSpecimenId(fromId: string, toId: string): Promise<SpecimenRow | null> {
  if (fromId === toId) return (await db.specimens.get(fromId)) ?? null
  const from = await db.specimens.get(fromId)
  if (!from) return (await db.specimens.get(toId)) ?? null

  await db.transaction('rw', db.specimens, db.covers, db.images, db.inbox, async () => {
    const covers = await db.covers.where('specimenId').equals(fromId).toArray()
    const target = await db.specimens.get(toId)
    if (target) {
      for (const cover of covers) {
        await db.covers.put({ ...cover, specimenId: toId })
      }
      await db.specimens.delete(fromId)
      const imageStillUsed =
        (await db.specimens.where('imageId').equals(from.imageId).count()) +
        (await db.inbox.where('imageId').equals(from.imageId).count())
      if (imageStillUsed === 0) await db.images.delete(from.imageId)
      return
    }

    await db.specimens.add({ ...from, id: toId })
    for (const cover of covers) {
      await db.covers.put({ ...cover, specimenId: toId })
    }
    await db.specimens.delete(fromId)
  })

  return (await db.specimens.get(toId)) ?? null
}

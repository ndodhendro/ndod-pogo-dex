import { categoryForTag } from '../data/navIcons'
import { formatDexSpeciesId } from './dexGrid'
import { specimenSlotDisplayName, type TagCatalog } from './roster'
import { screenshotFileName } from './screenshotFileName'
import {
  isNotPure,
  isSilhouette,
  specimenChipLabel,
  specimenTags,
  type SpecimenFields,
  type TagId,
} from './tags'

export type GallerySearchCategory = {
  seed: boolean
  name: string
  requiredTags: TagId[]
}

function galleryChipLabel(
  tag: TagId,
  specimen: SpecimenFields,
  categories: GallerySearchCategory[],
) {
  return specimenChipLabel(tag, specimen, categoryForTag(categories, tag)?.name)
}

/** Text shown on a Galleries card: number, name, chips, filename. */
export function galleryVisibleLabels(
  specimen: SpecimenFields & { fileName?: string | null },
  categories: GallerySearchCategory[] = [],
  catalogs: readonly TagCatalog[] = [],
): string[] {
  const labels = [
    formatDexSpeciesId(specimen.speciesId),
    specimenSlotDisplayName(specimen, catalogs),
    ...specimenTags(specimen).map((tag) => galleryChipLabel(tag, specimen, categories)),
  ]
  if (isSilhouette(specimen)) labels.push('Seen')
  if (isNotPure(specimen)) labels.push('Not Pure')
  const fileName = screenshotFileName(specimen.fileName)
  if (fileName) labels.push(fileName)
  return labels.filter((label) => label.trim().length > 0)
}

export function specimenMatchesGalleryQuery(
  specimen: SpecimenFields & { fileName?: string | null },
  query: string,
  categories: GallerySearchCategory[] = [],
  catalogs: readonly TagCatalog[] = [],
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return galleryVisibleLabels(specimen, categories, catalogs).some((label) =>
    label.toLowerCase().includes(q),
  )
}

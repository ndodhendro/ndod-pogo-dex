import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { colorForCategory, iconForCategory, toneForCategory } from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity } from '../lib/covers'
import { deleteSpecimen, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { db, type SpecimenRow } from '../lib/db'
import { toastAfterWrite, useToast } from '../lib/toast'
import { hasAllRequired, specimenTags } from '../lib/tags'
import styles from './Gallery.module.css'

export function GalleryPage() {
  const { categoryId, speciesId } = useParams()
  const { showToast } = useToast()
  const species = SPECIES_BY_ID.get(Number(speciesId))
  const category = useLiveQuery(
    () => (categoryId ? db.categories.get(categoryId) : undefined),
    [categoryId],
  )
  const specimens =
    useLiveQuery(
      () => db.specimens.where('speciesId').equals(Number(speciesId)).reverse().sortBy('createdAt'),
      [speciesId],
    ) ?? []
  const cover = useLiveQuery(
    () =>
      categoryId && speciesId
        ? db.covers.get([categoryId, Number(speciesId)])
        : undefined,
    [categoryId, speciesId],
  )
  const [preview, setPreview] = useState<SpecimenRow | null>(null)
  const previewUrl = useImageUrl(preview?.imageId, 'original')

  if (!species) return <p className="empty-state">Unknown species.</p>

  return (
    <section>
      <p className="page-sub">
        <Link
          to={`/dex/${categoryId}`}
          data-tone={category ? toneForCategory(category) : 'dex'}
          style={category ? categoryChromeStyle(colorForCategory(category)) : undefined}
        >
          ←{' '}
          {category ? (
            <>
              <span aria-hidden="true">{iconForCategory(category)} </span>
              {category.name}
            </>
          ) : (
            'Pokédex'
          )}
        </Link>
      </p>
      <h1 className="page-title">{species.name}</h1>
      <p className="page-sub">
        {specimens.length} specimen{specimens.length === 1 ? '' : 's'}
      </p>
      {specimens.length === 0 ? (
        <p className="empty-state">No screenshots for this species yet.</p>
      ) : (
        <div className={styles.grid}>
          {specimens.map((specimen) => (
            <GalleryCard
              key={specimen.id}
              specimen={specimen}
              isCover={cover?.specimenId === specimen.id}
              purity={
                cover?.specimenId === specimen.id && category
                  ? coverPurity(specimenTags(specimen), category.requiredTags)
                  : null
              }
              onOpen={() => setPreview(specimen)}
            />
          ))}
        </div>
      )}
      {preview && previewUrl && category ? (
        <CardPreview
          specimen={preview}
          imageUrl={previewUrl}
          canSetCover={hasAllRequired(specimenTags(preview), category.requiredTags)}
          onClose={() => setPreview(null)}
          onSetCover={() => {
            void setAsCover(category.id, preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Cover updated', cloudError)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not set cover'))
          }}
          onOpenGallery={() => setPreview(null)}
          onDelete={() =>
            deleteSpecimen(preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Specimen deleted', cloudError)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not delete'))
          }
        />
      ) : null}
    </section>
  )
}

function GalleryCard({
  specimen,
  isCover,
  purity,
  onOpen,
}: {
  specimen: SpecimenRow
  isCover: boolean
  purity: ReturnType<typeof coverPurity>
  onOpen: () => void
}) {
  const url = useImageUrl(specimen.imageId, 'thumb')
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  return (
    <DexCard
      name={isCover ? 'Cover' : species?.name ?? 'Specimen'}
      number={specimen.speciesId}
      thumbUrl={url}
      purity={purity}
      filled
      onClick={onOpen}
    />
  )
}

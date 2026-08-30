import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity } from '../lib/covers'
import { setAsCover } from '../lib/collection'
import { db, type SpecimenRow } from '../lib/db'
import { useToast } from '../lib/toast'
import { hasAllRequired, specimenTags } from '../lib/tags'

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
  const mediumUrl = useImageUrl(preview?.imageId, 'medium')

  if (!species) return <p className="empty-state">Unknown species.</p>

  return (
    <section>
      <p className="page-sub">
        <Link to={`/dex/${categoryId}`}>← {category?.name ?? 'Dex'}</Link>
      </p>
      <h1 className="page-title">{species.name}</h1>
      <p className="page-sub">{specimens.length} specimen{specimens.length === 1 ? '' : 's'}</p>
      {specimens.length === 0 ? (
        <p className="empty-state">No screenshots for this species yet.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))',
            gap: '0.5rem',
          }}
        >
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
      {preview && mediumUrl && category ? (
        <CardPreview
          specimen={preview}
          mediumUrl={mediumUrl}
          canSetCover={hasAllRequired(specimenTags(preview), category.requiredTags)}
          onClose={() => setPreview(null)}
          onSetCover={() => {
            void setAsCover(category.id, preview.id)
              .then((cloudError) => {
                if (cloudError) showToast(cloudError, 'warning')
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not set cover'))
          }}
          onOpenGallery={() => setPreview(null)}
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

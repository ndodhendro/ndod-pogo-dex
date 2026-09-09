import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { SpecimenTagSheet } from '../components/TagSheet'
import { colorForCategory, iconForCategory, toneForCategory } from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity } from '../lib/covers'
import { deleteSpecimen, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { db, type SpecimenRow } from '../lib/db'
import { listNeighbor } from '../lib/previewSwipe'
import { toastAfterWrite, useToast } from '../lib/toast'
import { hasAllRequired, isSilhouette, specimenTags } from '../lib/tags'
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
  const coverRows =
    useLiveQuery(
      () =>
        categoryId && speciesId
          ? db.covers.where('[categoryId+speciesId]').equals([categoryId, Number(speciesId)]).toArray()
          : [],
      [categoryId, speciesId],
    ) ?? []
  const [preview, setPreview] = useState<SpecimenRow | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const previewIndex = preview ? specimens.findIndex((row) => row.id === preview.id) : -1
  const previewNext = listNeighbor(specimens, previewIndex, 1)
  const previewPrev = listNeighbor(specimens, previewIndex, -1)
  const previewUrl = useImageUrl(preview?.imageId, 'original')
  const nextUrl = useImageUrl(previewNext?.imageId, 'original')
  const prevUrl = useImageUrl(previewPrev?.imageId, 'original')

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
              isCover={coverRows.some((row) => row.specimenId === specimen.id)}
              purity={
                coverRows.some((row) => row.specimenId === specimen.id) && category
                  ? coverPurity(specimenTags(specimen), category.requiredTags, isSilhouette(specimen))
                  : null
              }
              onOpen={() => setPreview(specimen)}
            />
          ))}
        </div>
      )}
      {preview && category ? (
        <CardPreview
          specimen={preview}
          imageUrl={previewUrl ?? ''}
          prev={previewPrev ? { specimen: previewPrev, imageUrl: prevUrl ?? '' } : undefined}
          next={previewNext ? { specimen: previewNext, imageUrl: nextUrl ?? '' } : undefined}
          canSetCover={hasAllRequired(specimenTags(preview), category.requiredTags)}
          requiredTags={category.requiredTags}
          locked={editingTags}
          onClose={() => {
            setEditingTags(false)
            setPreview(null)
          }}
          onNext={previewNext ? () => setPreview(previewNext) : undefined}
          onPrev={previewPrev ? () => setPreview(previewPrev) : undefined}
          onEditTags={() => setEditingTags(true)}
          onSetCover={() => {
            void setAsCover(category.id, preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Cover updated', cloudError)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not set cover'))
          }}
          onOpenGallery={() => {
            setEditingTags(false)
            setPreview(null)
          }}
          onDelete={() =>
            deleteSpecimen(preview.id)
              .then((cloudError) => {
                toastAfterWrite(showToast, 'Specimen deleted', cloudError)
                setEditingTags(false)
                setPreview(null)
              })
              .catch((err) => showToast(err instanceof Error ? err.message : 'Could not delete'))
          }
        />
      ) : null}
      <SpecimenTagSheet
        specimen={editingTags ? preview : null}
        onClose={() => setEditingTags(false)}
        onSaved={(specimen) => {
          setEditingTags(false)
          if (specimen.speciesId !== Number(speciesId)) {
            setPreview(null)
            return
          }
          setPreview(specimen)
        }}
      />
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

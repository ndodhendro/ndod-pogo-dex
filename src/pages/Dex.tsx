import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { SearchField } from '../components/SearchField'
import { TrackChip } from '../components/TrackChip'
import { colorForCategory, iconForCategory, toneForCategory } from '../data/navIcons'
import { SPECIES, SPECIES_BY_ID, searchSpecies } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity, type CoverPurity } from '../lib/covers'
import { deleteSpecimen, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { dexGridLayout } from '../lib/dexGrid'
import { db, ensureSeedCategories, type CategoryRow, type CoverRow, type SpecimenRow } from '../lib/db'
import { toastAfterWrite, useToast } from '../lib/toast'
import { hasAllRequired, specimenTags } from '../lib/tags'
import styles from './Dex.module.css'

type Slot = {
  speciesId: number
  name: string
  filled: boolean
  purity: CoverPurity | null
  cover?: SpecimenRow
}

export function DexPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<SpecimenRow | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    void ensureSeedCategories()
  }, [])

  useLayoutEffect(() => {
    if (!host) return
    const readWidth = () => {
      const next = host.clientWidth
      if (next > 0) setWidth(next)
    }
    const ro = new ResizeObserver(readWidth)
    ro.observe(host)
    readWidth()
    return () => ro.disconnect()
  }, [host])

  const categories =
    useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const specimens = useLiveQuery(() => db.specimens.toArray(), []) ?? []
  const covers = useLiveQuery(() => db.covers.toArray(), []) ?? []

  const category = categories.find((c) => c.id === categoryId) ?? categories[0]

  const allSlots = useMemo(
    () => buildSlots(category, specimens, covers, ''),
    [category, specimens, covers],
  )
  const slots = useMemo(
    () => (query.trim() ? buildSlots(category, specimens, covers, query) : allSlots),
    [allSlots, category, specimens, covers, query],
  )

  const filledCount = allSlots.filter((s) => s.filled).length
  const { columns, rowHeight } = dexGridLayout(width)
  const rowCount = Math.ceil(slots.length / columns)
  const previewUrl = usePreviewImage(preview?.imageId)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => host,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  if (!categoryId) {
    if (categories[0]) {
      return <Navigate to={`/dex/${categories[0].id}`} replace />
    }
    return (
      <section>
        <h1 className="page-title">Pokédex</h1>
      </section>
    )
  }
  if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
    return <Navigate to={`/dex/${categories[0].id}`} replace />
  }

  return (
    <section>
      <h1
        className={`page-title ${styles.title}`}
        data-tone={category ? toneForCategory(category) : 'dex'}
        style={category ? categoryChromeStyle(colorForCategory(category)) : undefined}
      >
        {category ? (
          <>
            <span className={styles.titleIcon} aria-hidden="true">
              {iconForCategory(category)}
            </span>
            {category.name}
          </>
        ) : (
          'Pokédex'
        )}
      </h1>
      <p className={styles.progress}>
        {filledCount} / {SPECIES.length}
      </p>
      <div className={styles.tracks}>
        {categories.map((cat) => (
          <TrackChip
            key={cat.id}
            icon={iconForCategory(cat)}
            tone={toneForCategory(cat)}
            labelColor={colorForCategory(cat)}
            label={cat.name}
            active={cat.id === category?.id}
            onClick={() => navigate(`/dex/${cat.id}`)}
          />
        ))}
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Filter species" />
      <div ref={setHost} className={styles.gridHost} style={{ marginTop: '0.75rem' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((row) => {
            const start = row.index * columns
            const slice = slots.slice(start, start + columns)
            return (
              <div
                key={row.key}
                className={styles.row}
                style={{
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                }}
              >
                {slice.map((slot) => (
                  <DexSlotCard
                    key={slot.speciesId}
                    slot={slot}
                    onOpen={() => {
                      if (slot.cover) setPreview(slot.cover)
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {preview && category && previewUrl ? (
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
          onOpenGallery={() => {
            setPreview(null)
            navigate(`/dex/${category.id}/species/${preview.speciesId}`)
          }}
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

function DexSlotCard({ slot, onOpen }: { slot: Slot; onOpen: () => void }) {
  const url = useImageUrl(slot.cover?.imageId, 'thumb')
  return (
    <DexCard
      name={slot.name}
      number={slot.speciesId}
      thumbUrl={slot.filled ? url : null}
      purity={slot.purity}
      filled={slot.filled}
      onClick={slot.filled ? onOpen : undefined}
    />
  )
}

function usePreviewImage(imageId?: string) {
  return useImageUrl(imageId, 'original')
}

function buildSlots(
  category: CategoryRow | undefined,
  specimens: SpecimenRow[],
  covers: CoverRow[],
  query: string,
): Slot[] {
  const required = category?.requiredTags ?? []
  const bySpecies = new Map<number, SpecimenRow[]>()
  for (const specimen of specimens) {
    const list = bySpecies.get(specimen.speciesId) ?? []
    list.push(specimen)
    bySpecies.set(specimen.speciesId, list)
  }
  const coverMap = new Map<string, CoverRow>()
  for (const cover of covers) {
    if (category && cover.categoryId === category.id) {
      coverMap.set(`${cover.categoryId}:${cover.speciesId}`, cover)
    }
  }

  const list = query.trim() ? searchSpecies(query) : SPECIES
  return list.map((species) => {
    const group = bySpecies.get(species.id) ?? []
    const inCategory = group.some((s) => hasAllRequired(specimenTags(s), required))
    const coverRow = category ? coverMap.get(`${category.id}:${species.id}`) : undefined
    const cover =
      (coverRow && group.find((s) => s.id === coverRow.specimenId)) ||
      group.find((s) => hasAllRequired(specimenTags(s), required))
    const purity =
      inCategory && cover ? coverPurity(specimenTags(cover), required) : null
    return {
      speciesId: species.id,
      name: SPECIES_BY_ID.get(species.id)?.name ?? species.name,
      filled: inCategory,
      purity,
      cover: inCategory ? cover : undefined,
    }
  })
}

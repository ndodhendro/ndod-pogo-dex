import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { SearchField } from '../components/SearchField'
import { TrackChip } from '../components/TrackChip'
import { iconForCategory, toneForCategory } from '../data/navIcons'
import { SPECIES, SPECIES_BY_ID, searchSpecies } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { coverPurity, type CoverPurity } from '../lib/covers'
import { setAsCover } from '../lib/collection'
import { db, ensureSeedCategories, type CategoryRow, type CoverRow, type SpecimenRow } from '../lib/db'
import { useToast } from '../lib/toast'
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
  const parentRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)

  useEffect(() => {
    void ensureSeedCategories()
  }, [])

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

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
  const columns = Math.max(3, Math.min(6, Math.floor((width + 8) / 112)))
  const rowCount = Math.ceil(slots.length / columns)
  const cardWidth = (width - (columns - 1) * 8) / columns
  const rowHeight = cardWidth * (4 / 3) + 22
  const mediumUrl = usePreviewImage(preview?.imageId)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  if (categories.length > 0 && !categoryId) {
    return <Navigate to={`/dex/${categories[0].id}`} replace />
  }
  if (categories.length > 0 && categoryId && !categories.some((c) => c.id === categoryId)) {
    return <Navigate to={`/dex/${categories[0].id}`} replace />
  }

  return (
    <section>
      <h1 className="page-title" data-tone={category ? toneForCategory(category) : 'dex'}>
        {category?.name ?? 'Dex'}
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
            label={cat.name}
            active={cat.id === category?.id}
            onClick={() => navigate(`/dex/${cat.id}`)}
          />
        ))}
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Filter species" />
      <div ref={parentRef} className={styles.gridHost} style={{ marginTop: '0.75rem' }}>
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
      {preview && category && mediumUrl ? (
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
          onOpenGallery={() => {
            setPreview(null)
            navigate(`/dex/${category.id}/species/${preview.speciesId}`)
          }}
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
  return useImageUrl(imageId, 'medium')
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

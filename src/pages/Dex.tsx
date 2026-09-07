import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { DexProgress } from '../components/DexProgress'
import { SearchField } from '../components/SearchField'
import { SearchableSelect } from '../components/SearchableSelect'
import { SpecimenTagSheet } from '../components/TagSheet'
import { colorForCategory, iconForCategory, TAB_LOGOS, toneForCategory } from '../data/navIcons'
import { SPECIES, SPECIES_BY_ID, searchSpecies } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { useFrameHeight } from '../hooks/useCropSettings'
import { coverPurity, type CoverPurity } from '../lib/covers'
import { deleteSpecimen, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import { countFilledSpecies, dexGridLayout } from '../lib/dexGrid'
import { db, ensureSeedCategories, type CategoryRow, type CoverRow, type SpecimenRow } from '../lib/db'
import { listNeighbor } from '../lib/previewSwipe'
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
  const [editingTags, setEditingTags] = useState(false)
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

  const category = categories.find((c) => c.id === categoryId)
  const trackOptions = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        icon: iconForCategory(cat),
        label: cat.name,
        tone: toneForCategory(cat),
        labelColor: colorForCategory(cat),
      })),
    [categories],
  )

  const allSlots = useMemo(
    () => buildSlots(category, specimens, covers, ''),
    [category, specimens, covers],
  )
  const slots = useMemo(
    () => (query.trim() ? buildSlots(category, specimens, covers, query) : allSlots),
    [allSlots, category, specimens, covers, query],
  )

  const filledCount = useMemo(
    () => countFilledSpecies(specimens, category?.requiredTags ?? []),
    [specimens, category],
  )
  const catalogSize = SPECIES.length
  const frameHeight = useFrameHeight()
  const { columns, rowHeight } = dexGridLayout(width, frameHeight)
  const rowCount = Math.ceil(slots.length / columns)
  const previewQueue = useMemo(
    () => slots.flatMap((slot) => (slot.cover ? [slot.cover] : [])),
    [slots],
  )
  const previewIndex = preview ? previewQueue.findIndex((row) => row.id === preview.id) : -1
  const previewNext = listNeighbor(previewQueue, previewIndex, 1)
  const previewPrev = listNeighbor(previewQueue, previewIndex, -1)
  const previewUrl = usePreviewImage(preview?.imageId)
  const nextUrl = usePreviewImage(previewNext?.imageId)
  const prevUrl = usePreviewImage(previewPrev?.imageId)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => host,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  if (categories.length > 0 && !category) {
    return <Navigate to="/dex" replace />
  }

  return (
    <section>
      <p className={`page-sub ${styles.back}`}>
        <Link to="/dex" data-tone="dex">
          <span aria-hidden="true">
            <img
              className={styles.backLogo}
              src={`${import.meta.env.BASE_URL}${TAB_LOGOS.dex}`}
              alt=""
              width={20}
              height={20}
              draggable={false}
            />
          </span>
          Pokédex
        </Link>
      </p>
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
      <DexProgress
        filled={filledCount}
        total={catalogSize}
        ariaLabel={`${category?.name ?? 'Pokédex'} completion`}
        tone={category ? toneForCategory(category) : 'dex'}
        labelColor={category ? colorForCategory(category) : undefined}
      />
      <div className={styles.toolbar}>
        <SearchableSelect
          className={styles.trackSelect}
          value={category?.id ?? ''}
          options={trackOptions}
          ariaLabel="Track"
          searchPlaceholder="Search tracks"
          onChange={(id) => {
            if (id !== category?.id) navigate(`/dex/${id}`)
          }}
        />
        <SearchField
          className={styles.speciesSearch}
          value={query}
          onChange={setQuery}
          placeholder="Filter species"
        />
      </div>
      <div ref={setHost} className={styles.gridHost}>
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
      {preview && category ? (
        <CardPreview
          specimen={preview}
          imageUrl={previewUrl ?? ''}
          prev={previewPrev ? { specimen: previewPrev, imageUrl: prevUrl ?? '' } : undefined}
          next={previewNext ? { specimen: previewNext, imageUrl: nextUrl ?? '' } : undefined}
          canSetCover={hasAllRequired(specimenTags(preview), category.requiredTags)}
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
            navigate(`/dex/${category.id}/species/${preview.speciesId}`)
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
          if (
            !category ||
            specimen.speciesId !== preview?.speciesId ||
            !hasAllRequired(specimenTags(specimen), category.requiredTags)
          ) {
            setPreview(null)
            return
          }
          setPreview(specimen)
        }}
      />
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

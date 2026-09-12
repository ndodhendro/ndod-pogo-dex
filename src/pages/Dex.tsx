import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { CardPreview } from '../components/CardPreview'
import { DexCard } from '../components/DexCard'
import { DexProgress } from '../components/DexProgress'
import { SearchField } from '../components/SearchField'
import { SearchableSelect } from '../components/SearchableSelect'
import { SpecimenTagSheet } from '../components/TagSheet'
import { TagChip } from '../components/TagChip'
import { GENERATION_IDS, GENERATIONS, groupByGeneration, type Generation } from '../data/generations'
import {
  colorForCategory,
  dexFilterTagChoices,
  dexLockedFilterTags,
  iconForCategory,
  toneForCategory,
} from '../data/navIcons'
import { useDexCollapse } from '../hooks/useDexCollapse'
import { useImageUrl } from '../hooks/useImageUrl'
import { useTrackFrameHeight } from '../hooks/useCropSettings'
import { coverPurity, findCover, type CoverPurity } from '../lib/covers'
import { deleteSpecimen, setAsCover } from '../lib/collection'
import { categoryChromeStyle } from '../lib/categoryStyle'
import {
  buildDexVirtualRows,
  dexAnimatedCardRowHeight,
  dexGenHeaderHeight,
  dexGridLayout,
  dexOpenAmount,
  keepDexSlot,
  pickDexCover,
  specimenMatchesDexFilters,
  specimenMatchesProgressFilter,
  type DexProgressKind,
} from '../lib/dexGrid'
import {
  db,
  ensureSeedCategories,
  type CategoryRow,
  type CoverRow,
  type SpecimenRow,
  type TagCatalogRow,
  type TagRosterRow,
} from '../lib/db'
import { listNeighbor } from '../lib/previewSwipe'
import {
  countFilledSlots,
  searchSlots,
  slotsForTrack,
  specimenFillsSlot,
  slotVariantForTrack,
  trackIsLimited,
  type SlotProgress,
} from '../lib/roster'
import { toastAfterWrite, useToast } from '../lib/toast'
import { hasAllRequired, isSilhouette, specimenTags, toggleRequiredTags, type TagId } from '../lib/tags'
import styles from './Dex.module.css'

type Slot = {
  speciesId: number
  variant: string
  name: string
  filled: boolean
  purity: CoverPurity | null
  cover?: SpecimenRow
}

const EMPTY_CATEGORIES: CategoryRow[] = []
const EMPTY_SPECIMENS: SpecimenRow[] = []
const EMPTY_COVERS: CoverRow[] = []
const EMPTY_CATALOGS: TagCatalogRow[] = []
const EMPTY_ROSTER: TagRosterRow[] = []

export function DexPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [progressFilter, setProgressFilter] = useState<DexProgressKind | null>(null)
  const [filterTags, setFilterTags] = useState<TagId[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [preview, setPreview] = useState<SpecimenRow | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const { collapsed, amounts, toggle, setCollapsedTo } = useDexCollapse()

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
    useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? EMPTY_CATEGORIES
  const specimens = useLiveQuery(() => db.specimens.toArray(), []) ?? EMPTY_SPECIMENS
  const covers = useLiveQuery(() => db.covers.toArray(), []) ?? EMPTY_COVERS
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? EMPTY_CATALOGS
  const roster = useLiveQuery(() => db.tagRoster.toArray(), []) ?? EMPTY_ROSTER

  const category = categories.find((c) => c.id === categoryId)
  const requiredTags = category?.requiredTags ?? []
  const requiredKey = requiredTags.join('\0')
  const lockedFilterTags = useMemo(
    () => dexLockedFilterTags(requiredKey ? requiredKey.split('\0') : []),
    [requiredKey],
  )
  const lockedFilterSet = useMemo(() => new Set(lockedFilterTags), [lockedFilterTags])
  const tagFilters = useMemo(
    () => dexFilterTagChoices(categories, requiredTags),
    [categories, requiredTags],
  )

  useEffect(() => {
    setFilterTags((tags) => {
      const next = tags.filter((tag) => !lockedFilterSet.has(tag))
      return next.length === tags.length ? tags : next
    })
  }, [lockedFilterSet])
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
    () => buildSlots(category, specimens, covers, catalogs, roster, '', progressFilter, filterTags),
    [category, specimens, covers, catalogs, roster, progressFilter, filterTags],
  )
  const slots = useMemo(
    () =>
      query.trim()
        ? buildSlots(category, specimens, covers, catalogs, roster, query, progressFilter, filterTags)
        : allSlots,
    [allSlots, category, specimens, covers, catalogs, roster, query, progressFilter, filterTags],
  )
  const groups = useMemo(() => groupByGeneration(slots), [slots])

  const { seen, caught, pure, total: catalogSize } = useMemo(
    () => countFilledSlots(specimens, category?.requiredTags ?? [], catalogs, roster),
    [specimens, category, catalogs, roster],
  )
  const generationProgress = useMemo(() => {
    const required = category?.requiredTags ?? []
    return new Map(
      GENERATIONS.map((generation) => [
        generation.id,
        countFilledSlots(specimens, required, catalogs, roster, {
          start: generation.start,
          end: generation.end,
        }),
      ]),
    )
  }, [specimens, category, catalogs, roster])
  const tagFiltering = filterTags.length > 0 || Boolean(query.trim())
  const filtering = progressFilter != null || tagFiltering
  const selectedTagCount =
    filterTags.length === 0 ? 0 : filterTags.length + lockedFilterTags.length
  const filterCount = selectedTagCount + (query.trim() ? 1 : 0)
  const limitedEmpty =
    Boolean(category) &&
    trackIsLimited(category?.requiredTags ?? [], catalogs) &&
    catalogSize === 0
  const frameHeight = useTrackFrameHeight(requiredTags)
  const { columns, rowHeight } = dexGridLayout(width, frameHeight)
  const rows = useMemo(
    () => buildDexVirtualRows(groups, columns, collapsed, { amounts, rowHeight }),
    [groups, columns, collapsed, amounts, rowHeight],
  )
  const visibleSlots = useMemo(
    () => groups.flatMap((group) => (collapsed.has(group.generation.id) ? [] : group.items)),
    [groups, collapsed],
  )
  const previewQueue = useMemo(
    () => visibleSlots.flatMap((slot) => (slot.cover ? [slot.cover] : [])),
    [visibleSlots],
  )
  const previewIndex = preview ? previewQueue.findIndex((row) => row.id === preview.id) : -1
  const previewNext = listNeighbor(previewQueue, previewIndex, 1)
  const previewPrev = listNeighbor(previewQueue, previewIndex, -1)
  const previewUrl = usePreviewImage(preview?.imageId)
  const nextUrl = usePreviewImage(previewNext?.imageId)
  const prevUrl = usePreviewImage(previewPrev?.imageId)
  const visibleIds = useMemo(() => groups.map((group) => group.generation.id), [groups])
  const allExpanded = visibleIds.length > 0 && visibleIds.every((id) => !collapsed.has(id))

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => host,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row || row.kind === 'header') return dexGenHeaderHeight(row?.lead ?? true)
      return dexAnimatedCardRowHeight(
        row.rowIndex,
        row.rowCount,
        rowHeight,
        dexOpenAmount(row.generationId, collapsed, amounts),
      )
    },
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 8,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [amounts, rowHeight, virtualizer])

  if (categories.length > 0 && !category) {
    return <Navigate to="/dex" replace />
  }

  return (
    <section className={styles.page}>
      <div className={styles.titleRow}>
        <SearchableSelect
          className={styles.trackSelect}
          value={category?.id ?? ''}
          options={trackOptions}
          ariaLabel="Track"
          searchPlaceholder="Search tracks"
          chevron={false}
          sizeToLongest
          onChange={(id) => {
            if (id !== category?.id) navigate(`/dex/${id}`)
          }}
        />
        <SearchField
          className={styles.speciesSearch}
          value={query}
          onChange={setQuery}
          placeholder="Species"
          aria-label="Species"
        />
        <button
          type="button"
          className={`btn ${styles.iconBtn}`}
          data-tone={category ? toneForCategory(category) : 'dex'}
          data-on={filterCount > 0 ? 'true' : 'false'}
          aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          <span aria-hidden="true">🏷️</span>
          {filterCount > 0 ? <span className={styles.badge}>{filterCount}</span> : null}
        </button>
        <button
          type="button"
          className={`btn ${styles.iconBtn}`}
          data-tone={category ? toneForCategory(category) : 'dex'}
          disabled={visibleIds.length === 0}
          aria-label={allExpanded ? 'Collapse All' : 'Expand All'}
          onClick={() => {
            if (allExpanded) setCollapsedTo(visibleIds, new Set(GENERATION_IDS))
            else setCollapsedTo(visibleIds, new Set())
          }}
        >
          <span className={styles.allChevron} data-expanded={allExpanded ? 'true' : 'false'} aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
      <DexProgress
        compact
        seen={seen}
        caught={caught}
        pure={pure}
        total={catalogSize}
        ariaLabel={`${category?.name ?? 'Pokédex'} completion`}
        tone={category ? toneForCategory(category) : 'dex'}
        labelColor={category ? colorForCategory(category) : undefined}
        selectedKind={progressFilter}
        onSelectKind={setProgressFilter}
      />
      {limitedEmpty ? (
        <p className="empty-state">
          No released species yet. Add them in{' '}
          <Link to="/settings" data-tone="settings">
            <span aria-hidden="true">⚙️</span> Settings
          </Link>
          .
        </p>
      ) : filtering && slots.length === 0 ? (
        <p className="empty-state">
          {query.trim()
            ? 'No matching species.'
            : filterTags.length > 0
              ? 'No matching tags.'
              : progressFilter === 'caught'
                ? 'None caught on this track.'
                : progressFilter === 'pure'
                  ? 'None pure on this track.'
                  : 'None seen on this track.'}
        </p>
      ) : (
      <div ref={setHost} className={styles.gridHost}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]
            if (!row) return null
            if (row.kind === 'header') {
              return (
                <div
                  key={row.key}
                  className={styles.headerRow}
                  data-lead={row.lead ? 'true' : 'false'}
                  style={{
                    height: `${item.size}px`,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <GenerationHeader
                    generation={row.generation}
                    expanded={!collapsed.has(row.generation.id)}
                    progress={generationProgress.get(row.generation.id)}
                    onToggle={() => toggle(row.generation.id)}
                  />
                </div>
              )
            }
            return (
              <div
                key={row.key}
                className={styles.row}
                style={{
                  height: `${item.size}px`,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <div
                  className={styles.rowGrid}
                  style={{
                    height: `${rowHeight}px`,
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  }}
                >
                  {row.slots.map((slot) => (
                    <DexSlotCard
                      key={`${slot.speciesId}:${slot.variant}`}
                      slot={slot}
                      onOpen={() => {
                        if (slot.cover) setPreview(slot.cover)
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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
            !preview ||
            !specimenMatchesProgressFilter(specimen, category.requiredTags, progressFilter) ||
            !hasAllRequired(specimenTags(specimen), filterTags) ||
            !specimenFillsSlot(
              specimen,
              category.requiredTags,
              {
                speciesId: preview.speciesId,
                variant: slotVariantForTrack(preview, category.requiredTags, catalogs),
                name: '',
              },
              catalogs,
            )
          ) {
            setPreview(null)
            return
          }
          setPreview(specimen)
        }}
      />
      <BottomSheet
        open={filtersOpen}
        title="Filters"
        showClose={false}
        onClose={() => setFiltersOpen(false)}
        headerAction={
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!tagFiltering}
            onClick={() => {
              setFilterTags([])
              setQuery('')
            }}
          >
            <span aria-hidden="true">✖️</span>
            Clear
          </button>
        }
      >
        <div className="chip-row">
          {tagFilters.map((choice) => {
            const tag = choice.tag as TagId
            const locked = lockedFilterSet.has(tag)
            return (
              <TagChip
                key={tag}
                tag={tag}
                selected={locked || filterTags.includes(tag)}
                locked={locked}
                icon={choice.icon}
                label={choice.label}
                labelColor={choice.labelColor}
                onClick={() => setFilterTags((tags) => toggleRequiredTags(tags, [tag]))}
              />
            )
          })}
        </div>
      </BottomSheet>
    </section>
  )
}

function GenerationHeader({
  generation,
  expanded,
  progress,
  onToggle,
}: {
  generation: Generation
  expanded: boolean
  progress?: SlotProgress
  onToggle: () => void
}) {
  const counts = progress ?? { seen: 0, caught: 0, pure: 0, filled: 0, total: 0 }
  return (
    <button
      type="button"
      className={styles.genHeader}
      style={categoryChromeStyle(generation.color)}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span className={styles.genTitle}>
        <span className={styles.genNumber}>{generation.id}</span>
        <span className={styles.genName}>{generation.name}</span>
        <span className={styles.genChevron} aria-hidden="true">
          ▾
        </span>
      </span>
      <DexProgress
        compact
        embedded
        seen={counts.seen}
        caught={counts.caught}
        pure={counts.pure}
        total={counts.total}
        ariaLabel={`${generation.name} completion`}
        announce={false}
      />
    </button>
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
      fill
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
  catalogs: TagCatalogRow[],
  roster: TagRosterRow[],
  query: string,
  progressFilter: DexProgressKind | null = null,
  filterTags: readonly TagId[] = [],
): Slot[] {
  const required = category?.requiredTags ?? []
  const defs = query.trim()
    ? searchSlots(slotsForTrack(required, catalogs, roster), query)
    : slotsForTrack(required, catalogs, roster)
  const categoryCovers = category ? covers.filter((row) => row.categoryId === category.id) : []
  const filtering = progressFilter != null || filterTags.length > 0

  const slots: Slot[] = []
  for (const def of defs) {
    const group = specimens.filter((row) =>
      specimenFillsSlot(row, required, def, catalogs),
    )
    const matching = group.filter(
      (row) =>
        specimenMatchesDexFilters(row, filterTags) &&
        specimenMatchesProgressFilter(row, required, progressFilter),
    )
    if (!keepDexSlot(matching.length > 0, filtering)) continue
    const coverRow = category
      ? findCover(categoryCovers, category.id, def.speciesId, def.variant)
      : undefined
    const cover = pickDexCover(filtering ? matching : group, coverRow?.specimenId)
    const inCategory = group.length > 0
    const purity =
      cover
        ? coverPurity(
            specimenTags(cover),
            required,
            isSilhouette(cover),
            cover.speciesId,
            cover.gender,
          )
        : null
    slots.push({
      speciesId: def.speciesId,
      variant: def.variant,
      name: def.name,
      filled: inCategory,
      purity,
      cover: cover,
    })
  }
  return slots
}

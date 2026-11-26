import { useSyncExternalStore } from 'react'

export const GALLERY_COLUMNS_KEY = 'ndod.galleryColumns'
export const GALLERY_COLUMN_OPTIONS = [2, 3, 4, 5, 6] as const
export const DEFAULT_GALLERY_COLUMNS = 5

export type GalleryColumnCount = (typeof GALLERY_COLUMN_OPTIONS)[number]

const listeners = new Set<() => void>()

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export function galleryColumnCount(value: string | null): GalleryColumnCount {
  const count = Number(value)
  return (GALLERY_COLUMN_OPTIONS as readonly number[]).includes(count)
    ? (count as GalleryColumnCount)
    : DEFAULT_GALLERY_COLUMNS
}

export function getGalleryColumns(): GalleryColumnCount {
  try {
    return galleryColumnCount(memoryStore()?.getItem(GALLERY_COLUMNS_KEY) ?? null)
  } catch {
    return DEFAULT_GALLERY_COLUMNS
  }
}

export function setGalleryColumns(count: number) {
  const next = galleryColumnCount(String(count))
  try {
    memoryStore()?.setItem(GALLERY_COLUMNS_KEY, String(next))
  } catch {
    // private mode / denied storage
  }
  listeners.forEach((fn) => fn())
}

export function subscribeGalleryColumns(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === GALLERY_COLUMNS_KEY || event.key === null) {
      listeners.forEach((fn) => fn())
    }
  })
}

export function useGalleryColumns() {
  return useSyncExternalStore(subscribeGalleryColumns, getGalleryColumns, () => DEFAULT_GALLERY_COLUMNS)
}

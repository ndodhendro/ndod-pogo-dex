import { useEffect, useState } from 'react'
import { db } from '../lib/db'

const cache = new Map<string, string>()
const forgetListeners = new Set<(imageId: string) => void>()

function cacheKey(imageId: string, size: 'thumb' | 'medium' | 'original') {
  return `${imageId}:${size}`
}

export function cachedImageUrl(
  imageId: string | undefined,
  size: 'thumb' | 'medium' | 'original',
): string | null {
  if (!imageId) return null
  return cache.get(cacheKey(imageId, size)) ?? null
}

export function forgetImageUrls(imageId: string) {
  for (const size of ['thumb', 'medium', 'original'] as const) {
    const key = cacheKey(imageId, size)
    const url = cache.get(key)
    if (url) URL.revokeObjectURL(url)
    cache.delete(key)
  }
  forgetListeners.forEach((listener) => listener(imageId))
}

export function useImageUrl(imageId: string | undefined, size: 'thumb' | 'medium' | 'original') {
  const [asyncUrl, setAsyncUrl] = useState<string | null>(null)
  const [asyncKey, setAsyncKey] = useState('')
  const [generation, setGeneration] = useState(0)
  const key = imageId ? cacheKey(imageId, size) : ''

  useEffect(() => {
    const onForget = (id: string) => {
      if (id !== imageId) return
      setAsyncUrl(null)
      setAsyncKey('')
      setGeneration((value) => value + 1)
    }
    forgetListeners.add(onForget)
    return () => {
      forgetListeners.delete(onForget)
    }
  }, [imageId])

  useEffect(() => {
    if (!imageId || !key) {
      setAsyncUrl(null)
      setAsyncKey('')
      return
    }
    const cached = cache.get(key)
    if (cached) {
      setAsyncUrl(cached)
      setAsyncKey(key)
      return
    }
    let cancelled = false
    db.images.get(imageId).then((row) => {
      if (!row || cancelled) return
      const created = URL.createObjectURL(row[size])
      cache.set(key, created)
      setAsyncUrl(created)
      setAsyncKey(key)
    })
    return () => {
      cancelled = true
    }
  }, [imageId, size, key, generation])

  return cachedImageUrl(imageId, size) ?? (asyncKey === key ? asyncUrl : null)
}

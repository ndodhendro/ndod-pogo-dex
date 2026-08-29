import { useEffect, useState } from 'react'
import { db } from '../lib/db'

const cache = new Map<string, string>()

export function useImageUrl(imageId: string | undefined, size: 'thumb' | 'medium' | 'original') {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!imageId) {
      setUrl(null)
      return
    }
    const key = `${imageId}:${size}`
    const cached = cache.get(key)
    if (cached) {
      setUrl(cached)
      return
    }
    let cancelled = false
    db.images.get(imageId).then((row) => {
      if (!row || cancelled) return
      const created = URL.createObjectURL(row[size])
      cache.set(key, created)
      setUrl(created)
    })
    return () => {
      cancelled = true
    }
  }, [imageId, size])

  return url
}

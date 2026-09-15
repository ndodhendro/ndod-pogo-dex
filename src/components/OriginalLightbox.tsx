import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LIGHTBOX_CLICK_GUARD_MS, shouldCloseOriginalLightbox } from '../lib/lightboxGesture'
import { PREVIEW_TAP_SLOP } from '../lib/previewSwipe'
import { screenshotCssSize } from '../lib/screenshotDisplay'
import styles from './OriginalLightbox.module.css'

type Props = {
  src: string
  alt?: string
  onClose: () => void
}

export function OriginalLightbox({ src, alt = '', onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(performance.now())
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const startedHereRef = useRef(false)
  const movedRef = useRef(false)

  useEffect(() => {
    openedAtRef.current = performance.now()
    startedHereRef.current = false
    movedRef.current = false
    startRef.current = null
  }, [src])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    const allowScroll = (event: Event) => {
      const root = rootRef.current
      if (!root || !(event.target instanceof Node) || !root.contains(event.target)) return
      event.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', allowScroll, { capture: true })
    window.addEventListener('touchmove', allowScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', allowScroll, true)
      window.removeEventListener('touchmove', allowScroll, true)
    }
  }, [onClose])

  function markMoved(clientX: number, clientY: number) {
    const start = startRef.current
    if (!start) return
    if (Math.abs(clientX - start.x) >= PREVIEW_TAP_SLOP || Math.abs(clientY - start.y) >= PREVIEW_TAP_SLOP) {
      movedRef.current = true
    }
  }

  function tryClose(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault()
    event.stopPropagation()
    if (
      !shouldCloseOriginalLightbox({
        now: performance.now(),
        openedAt: openedAtRef.current,
        pointerStartedOnLightbox: startedHereRef.current,
        moved: movedRef.current,
      })
    ) {
      return
    }
    startedHereRef.current = false
    onClose()
  }

  return createPortal(
    <div
      ref={rootRef}
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label="Original screenshot"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (performance.now() - openedAtRef.current < LIGHTBOX_CLICK_GUARD_MS) return
        startedHereRef.current = true
        startRef.current = { x: event.clientX, y: event.clientY }
        movedRef.current = false
      }}
      onPointerMove={(event) => markMoved(event.clientX, event.clientY)}
      onPointerUp={(event) => {
        event.stopPropagation()
        markMoved(event.clientX, event.clientY)
      }}
      onPointerCancel={() => {
        startRef.current = null
        startedHereRef.current = false
        movedRef.current = true
      }}
      onScroll={() => {
        movedRef.current = true
      }}
      onClick={tryClose}
    >
      <LightboxImage src={src} alt={alt} />
    </div>,
    document.body,
  )
}

function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [display, setDisplay] = useState<{ width: number; height: number } | null>(null)

  const measure = useCallback((img: HTMLImageElement) => {
    if (!img.naturalWidth) return
    setDisplay(screenshotCssSize(img.naturalWidth, img.naturalHeight, window.devicePixelRatio || 1))
  }, [])

  useEffect(() => {
    setDisplay(null)
    const img = imgRef.current
    if (img?.complete) measure(img)
  }, [src, measure])

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      draggable={false}
      data-sized={display ? 'true' : undefined}
      style={display ? { width: display.width, height: display.height } : undefined}
      onLoad={(e) => measure(e.currentTarget)}
    />
  )
}

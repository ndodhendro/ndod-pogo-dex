import { useEffect, useRef, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import styles from './BottomSheet.module.css'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

function scrollableAncestor(start: EventTarget | null, root: HTMLElement | null): HTMLElement | null {
  if (!root || !(start instanceof Element)) return null
  let el: HTMLElement | null = start instanceof HTMLElement ? start : start.parentElement
  while (el && root.contains(el)) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
      return el
    }
    el = el.parentElement
  }
  return null
}

function canScroll(el: HTMLElement, deltaY: number) {
  if (deltaY < 0) return el.scrollTop > 0
  return el.scrollTop + el.clientHeight < el.scrollHeight - 1
}

export function BottomSheet({ open, title, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const scrollY = window.scrollY
    const prev = {
      htmlOverflow: documentElement.style.overflow,
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    }
    const gap = window.innerWidth - documentElement.clientWidth
    documentElement.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    if (gap > 0) body.style.paddingRight = `${gap}px`

    const onWheel = (event: WheelEvent) => {
      const scroller = scrollableAncestor(event.target, sheetRef.current)
      if (scroller && canScroll(scroller, event.deltaY)) return
      event.preventDefault()
    }
    const onTouchMove = (event: TouchEvent) => {
      const sheet = sheetRef.current
      if (sheet && event.target instanceof Node && sheet.contains(event.target)) return
      event.preventDefault()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      documentElement.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.overflow
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.paddingRight = prev.paddingRight
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchmove', onTouchMove)
      window.scrollTo(0, scrollY)
    }
  }, [open])

  if (!open) return null

  function onSheetWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const scroller = scrollableAncestor(event.target, sheetRef.current)
    if (scroller && canScroll(scroller, event.deltaY)) return
    event.preventDefault()
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onWheel={onSheetWheel}
      >
        <div className={styles.handle} />
        <div className={styles.head}>
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}

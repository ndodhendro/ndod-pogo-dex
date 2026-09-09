import { useCallback, useEffect, useId, useRef, useState, type AnimationEvent as ReactAnimationEvent, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent as ReactTransitionEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { sheetBackdropDim, sheetCloseY, sheetDragY, sheetShouldClose, SHEET_SWIPE_LOCK } from '../lib/sheetSwipe'
import styles from './BottomSheet.module.css'

type Phase = 'enter' | 'idle' | 'dragging' | 'leave'

type Props = {
  open: boolean
  title: string
  nested?: boolean
  showClose?: boolean
  headerAction?: ReactNode
  onClose: () => void
  children: ReactNode
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, [role="switch"]'))
}

export function BottomSheet({
  open,
  title,
  nested = false,
  showClose = true,
  headerAction,
  onClose,
  children,
}: Props) {
  const hintId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const shownRef = useRef(open)
  const closingRef = useRef(false)
  const startYRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const fromBodyRef = useRef(false)
  const [shown, setShown] = useState(open)
  const [phase, setPhase] = useState<Phase>(open ? 'enter' : 'idle')
  const [dragY, setDragY] = useState(0)
  onCloseRef.current = onClose
  shownRef.current = shown

  const finishClose = useCallback(() => {
    if (!shownRef.current) return
    shownRef.current = false
    closingRef.current = false
    dragYRef.current = 0
    setDragY(0)
    setPhase('idle')
    setShown(false)
    onCloseRef.current()
  }, [])

  const dismiss = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    draggingRef.current = false
    const height = sheetRef.current?.offsetHeight ?? 0
    const nextY = sheetCloseY(height)
    if (prefersReducedMotion() || Math.abs(dragYRef.current - nextY) < 2) {
      finishClose()
      return
    }
    setPhase('leave')
    dragYRef.current = nextY
    setDragY(nextY)
  }, [finishClose])

  useEffect(() => {
    if (phase !== 'enter') return
    const id = window.setTimeout(() => setPhase((current) => (current === 'enter' ? 'idle' : current)), 400)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'leave') return
    const id = window.setTimeout(finishClose, 400)
    return () => window.clearTimeout(id)
  }, [phase, finishClose])

  useEffect(() => {
    if (open) {
      closingRef.current = false
      draggingRef.current = false
      dragYRef.current = 0
      setDragY(0)
      setShown(true)
      setPhase(prefersReducedMotion() ? 'idle' : 'enter')
      return
    }
    if (shownRef.current) dismiss()
  }, [open, dismiss])

  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, dismiss])

  useEffect(() => {
    if (!shown) return
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
      if (draggingRef.current) {
        event.preventDefault()
        return
      }
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
  }, [shown])

  if (!shown) return null

  const height = sheetRef.current?.offsetHeight ?? 1
  const dim = phase === 'leave' ? 0 : sheetBackdropDim(dragY, height)
  const offset = phase === 'enter' ? undefined : dragY

  function onSheetWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const scroller = scrollableAncestor(event.target, sheetRef.current)
    if (scroller && canScroll(scroller, event.deltaY)) return
    event.preventDefault()
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (phase === 'enter' || phase === 'leave') return
    if (isInteractive(event.target)) return
    const body = bodyRef.current
    const onBody = Boolean(body && event.target instanceof Node && body.contains(event.target))
    if (onBody && body && body.scrollTop > 1) return
    fromBodyRef.current = onBody
    startYRef.current = event.clientY
    draggingRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const dy = event.clientY - startYRef.current
    if (!draggingRef.current) {
      if (Math.abs(dy) < SHEET_SWIPE_LOCK) return
      if (dy < 0 && fromBodyRef.current) {
        event.currentTarget.releasePointerCapture(event.pointerId)
        return
      }
      draggingRef.current = true
      setPhase('dragging')
    }
    const next = sheetDragY(dy)
    dragYRef.current = next
    setDragY(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!draggingRef.current) return
    draggingRef.current = false
    if (sheetShouldClose(dragYRef.current)) {
      dismiss()
      return
    }
    setPhase('idle')
    dragYRef.current = 0
    setDragY(0)
  }

  function onSheetTransitionEnd(event: ReactTransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'transform') return
    if (phase === 'leave') finishClose()
  }

  function onSheetAnimationEnd(event: ReactAnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (phase === 'enter') setPhase('idle')
  }

  return (
    <div
      className={styles.backdrop}
      data-nested={nested ? 'true' : undefined}
      data-phase={phase}
      style={{ '--sheet-dim': String(dim) } as CSSProperties}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        data-phase={phase}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={showClose ? undefined : hintId}
        style={offset == null ? undefined : { transform: `translateY(${offset}px)` }}
        onClick={(e) => e.stopPropagation()}
        onWheel={onSheetWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTransitionEnd={onSheetTransitionEnd}
        onAnimationEnd={onSheetAnimationEnd}
      >
        <div className={styles.handleHit}>
          <div className={styles.handle} />
        </div>
        {!showClose ? (
          <p id={hintId} className={styles.hint}>
            Drag down to close
          </p>
        ) : null}
        <div className={styles.head}>
          <h2>{title}</h2>
          {headerAction || showClose ? (
            <div className={styles.headActions}>
              {headerAction}
              {showClose ? (
                <button type="button" className="btn btn-ghost" onClick={dismiss}>
                  Close
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  )
}

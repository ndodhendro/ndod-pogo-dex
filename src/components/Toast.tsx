import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react'
import { useToast, type ToastMessage } from '../lib/toast'
import {
  toastCloseY,
  toastDragY,
  toastShouldClose,
  TOAST_ANIM_MS,
  TOAST_DURATION_MS,
  TOAST_SWIPE_LOCK,
} from '../lib/toastSwipe'
import styles from './Toast.module.css'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Toast() {
  const { toasts, dismissToast } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className={styles.region} role="status">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const nodeRef = useRef<HTMLButtonElement>(null)
  const startYRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const leavingRef = useRef(false)
  const draggedRef = useRef(false)
  const timerRef = useRef(0)
  const onDismissRef = useRef(onDismiss)
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'leave'>('idle')
  const [dragY, setDragY] = useState(0)
  onDismissRef.current = onDismiss

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = 0
    }
  }, [])

  const finish = useCallback(() => {
    if (!leavingRef.current) return
    leavingRef.current = false
    onDismissRef.current()
  }, [])

  const beginLeave = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    draggingRef.current = false
    clearTimer()
    if (prefersReducedMotion()) {
      finish()
      return
    }
    const height = nodeRef.current?.offsetHeight ?? 0
    const nextY = toastCloseY(height, dragYRef.current)
    if (Math.abs(dragYRef.current - nextY) < 2) {
      finish()
      return
    }
    setPhase('leave')
    window.requestAnimationFrame(() => {
      if (!leavingRef.current) return
      dragYRef.current = nextY
      setDragY(nextY)
    })
  }, [clearTimer, finish])

  const beginLeaveRef = useRef(beginLeave)
  beginLeaveRef.current = beginLeave

  const armTimer = useCallback(() => {
    clearTimer()
    timerRef.current = window.setTimeout(() => beginLeaveRef.current(), TOAST_DURATION_MS)
  }, [clearTimer])

  useEffect(() => {
    armTimer()
    return clearTimer
  }, [armTimer, clearTimer])

  useEffect(() => {
    if (phase !== 'leave') return
    const id = window.setTimeout(finish, TOAST_ANIM_MS + 80)
    return () => window.clearTimeout(id)
  }, [phase, finish])

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || leavingRef.current) return
    clearTimer()
    draggedRef.current = false
    draggingRef.current = false
    startYRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || leavingRef.current) return
    const dy = event.clientY - startYRef.current
    if (!draggingRef.current) {
      if (Math.abs(dy) < TOAST_SWIPE_LOCK) return
      draggingRef.current = true
      draggedRef.current = true
      setPhase('dragging')
    }
    const next = toastDragY(dy)
    dragYRef.current = next
    setDragY(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (leavingRef.current) return
    if (!draggingRef.current) {
      armTimer()
      return
    }
    draggingRef.current = false
    if (toastShouldClose(dragYRef.current)) {
      beginLeave()
      return
    }
    setPhase('idle')
    window.requestAnimationFrame(() => {
      if (leavingRef.current) return
      dragYRef.current = 0
      setDragY(0)
      armTimer()
    })
  }

  function onClick() {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    beginLeave()
  }

  function onTransitionEnd(event: ReactTransitionEvent<HTMLButtonElement>) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'transform') return
    if (phase === 'leave') finish()
  }

  return (
    <button
      ref={nodeRef}
      type="button"
      className={styles.toast}
      data-tone={toast.tone}
      data-phase={phase}
      style={{ transform: `translateY(${dragY}px)` }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTransitionEnd={onTransitionEnd}
    >
      {toast.text}
    </button>
  )
}

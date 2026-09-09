import { useCallback, useEffect, useRef, useState } from 'react'
import { DEX_SECTION_ANIM_MS, interpolateOpenAmount } from '../lib/dexGrid'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useDexCollapse() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())
  const [amounts, setAmounts] = useState<ReadonlyMap<number, number>>(() => new Map())
  const collapsedRef = useRef(collapsed)
  const amountsRef = useRef(amounts)
  const frameRef = useRef<number | null>(null)
  collapsedRef.current = collapsed
  amountsRef.current = amounts

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const setCollapsedTo = useCallback((ids: readonly number[], nextCollapsed: ReadonlySet<number>) => {
    const prevCollapsed = collapsedRef.current
    const prevAmounts = amountsRef.current
    const animating = new Set(ids)
    const from = new Map<number, number>()
    for (const id of ids) {
      from.set(id, prevAmounts.get(id) ?? (prevCollapsed.has(id) ? 0 : 1))
    }

    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    collapsedRef.current = nextCollapsed
    setCollapsed(nextCollapsed)

    if (prefersReducedMotion()) {
      amountsRef.current = new Map()
      setAmounts(new Map())
      return
    }

    const startAmounts = new Map(prevAmounts)
    for (const id of startAmounts.keys()) {
      if (!animating.has(id)) startAmounts.delete(id)
    }
    for (const id of ids) startAmounts.set(id, from.get(id) ?? 0)
    amountsRef.current = startAmounts
    setAmounts(startAmounts)

    const startedAt = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DEX_SECTION_ANIM_MS)
      const next = new Map(amountsRef.current)
      for (const id of ids) {
        next.set(id, interpolateOpenAmount(from.get(id) ?? 0, nextCollapsed.has(id) ? 0 : 1, t))
      }
      if (t >= 1) {
        for (const id of ids) next.delete(id)
        frameRef.current = null
      } else {
        frameRef.current = requestAnimationFrame(tick)
      }
      amountsRef.current = next
      setAmounts(next)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [])

  const toggle = useCallback(
    (id: number) => {
      const next = new Set(collapsedRef.current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setCollapsedTo([id], next)
    },
    [setCollapsedTo],
  )

  return { collapsed, amounts, toggle, setCollapsedTo }
}

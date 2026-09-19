type SavedStyles = {
  htmlOverflow: string
  overflow: string
  position: string
  top: string
  width: string
  paddingRight: string
}

let lockCount = 0
let saved: SavedStyles | null = null
let savedScrollY = 0

function host() {
  const { document: doc, window: win } = globalThis
  if (!doc?.documentElement || !doc.body || !win) return null
  return { doc, win }
}

/** Keep page scroll locked while any overlay is open. Nested sheets share one lock. */
export function lockBodyScroll() {
  const next = host()
  if (!next) return
  const { doc, win } = next
  if (lockCount === 0) {
    const { body, documentElement } = doc
    savedScrollY = win.scrollY
    saved = {
      htmlOverflow: documentElement.style.overflow,
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    }
    const gap = win.innerWidth - documentElement.clientWidth
    documentElement.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${savedScrollY}px`
    body.style.width = '100%'
    if (gap > 0) body.style.paddingRight = `${gap}px`
  }
  lockCount += 1
}

export function unlockBodyScroll() {
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount > 0 || !saved) return
  const next = host()
  const restore = saved
  const y = savedScrollY
  saved = null
  savedScrollY = 0
  if (!next) return
  const { body, documentElement } = next.doc
  documentElement.style.overflow = restore.htmlOverflow
  body.style.overflow = restore.overflow
  body.style.position = restore.position
  body.style.top = restore.top
  body.style.width = restore.width
  body.style.paddingRight = restore.paddingRight
  next.win.scrollTo(0, y)
}

export function resetBodyScrollLock() {
  if (lockCount > 0) {
    lockCount = 1
    unlockBodyScroll()
  }
  lockCount = 0
  saved = null
  savedScrollY = 0
}

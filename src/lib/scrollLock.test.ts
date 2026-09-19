import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lockBodyScroll, resetBodyScrollLock, unlockBodyScroll } from './scrollLock'

type StyleMap = {
  overflow: string
  position: string
  top: string
  width: string
  paddingRight: string
}

function emptyStyle(): StyleMap {
  return { overflow: '', position: '', top: '', width: '', paddingRight: '' }
}

function installHost(scrollY = 160) {
  const htmlStyle = emptyStyle()
  const bodyStyle = emptyStyle()
  const win = {
    scrollY,
    innerWidth: 1024,
    scrollTo(_x: number, y: number) {
      win.scrollY = y
    },
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: { style: htmlStyle, clientWidth: 1024 },
      body: { style: bodyStyle },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: win,
  })
  return { htmlStyle, bodyStyle, win }
}

describe('body scroll lock', () => {
  beforeEach(() => {
    resetBodyScrollLock()
  })

  afterEach(() => {
    resetBodyScrollLock()
    delete (globalThis as { document?: unknown }).document
    delete (globalThis as { window?: unknown }).window
  })

  it('locks the body on the first overlay', () => {
    const { htmlStyle, bodyStyle, win } = installHost(90)
    lockBodyScroll()
    expect(htmlStyle.overflow).toBe('hidden')
    expect(bodyStyle.overflow).toBe('hidden')
    expect(bodyStyle.position).toBe('fixed')
    expect(bodyStyle.top).toBe('-90px')
    expect(bodyStyle.width).toBe('100%')
    expect(win.scrollY).toBe(90)
  })

  it('keeps the page locked until the last overlay closes', () => {
    const { htmlStyle, bodyStyle } = installHost()
    lockBodyScroll()
    lockBodyScroll()
    unlockBodyScroll()
    expect(htmlStyle.overflow).toBe('hidden')
    expect(bodyStyle.position).toBe('fixed')
    unlockBodyScroll()
    expect(htmlStyle.overflow).toBe('')
    expect(bodyStyle.overflow).toBe('')
    expect(bodyStyle.position).toBe('')
    expect(bodyStyle.top).toBe('')
  })

  it('does not restore a nested lock captured from another sheet', () => {
    const { htmlStyle, bodyStyle, win } = installHost(240)
    lockBodyScroll()
    lockBodyScroll()
    unlockBodyScroll()
    unlockBodyScroll()
    expect(htmlStyle.overflow).toBe('')
    expect(bodyStyle.position).toBe('')
    expect(bodyStyle.overflow).toBe('')
    expect(win.scrollY).toBe(240)
  })

  it('ignores extra unlocks after the page is already free', () => {
    const { bodyStyle } = installHost()
    lockBodyScroll()
    unlockBodyScroll()
    unlockBodyScroll()
    expect(bodyStyle.position).toBe('')
  })
})

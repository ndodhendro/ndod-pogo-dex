import { describe, expect, it } from 'vitest'
import { LIGHTBOX_CLICK_GUARD_MS, shouldCloseOriginalLightbox } from './lightboxGesture'

describe('shouldCloseOriginalLightbox', () => {
  it('ignores the leftover click from the opening tap', () => {
    expect(
      shouldCloseOriginalLightbox({
        now: 10,
        openedAt: 0,
        pointerStartedOnLightbox: false,
        moved: false,
      }),
    ).toBe(false)
  })

  it('ignores a compatibility mouse click right after open', () => {
    expect(
      shouldCloseOriginalLightbox({
        now: LIGHTBOX_CLICK_GUARD_MS - 1,
        openedAt: 0,
        pointerStartedOnLightbox: true,
        moved: false,
      }),
    ).toBe(false)
  })

  it('closes on a later tap that started on the overlay', () => {
    expect(
      shouldCloseOriginalLightbox({
        now: LIGHTBOX_CLICK_GUARD_MS,
        openedAt: 0,
        pointerStartedOnLightbox: true,
        moved: false,
      }),
    ).toBe(true)
  })

  it('stays open when the finger panned', () => {
    expect(
      shouldCloseOriginalLightbox({
        now: LIGHTBOX_CLICK_GUARD_MS,
        openedAt: 0,
        pointerStartedOnLightbox: true,
        moved: true,
      }),
    ).toBe(false)
  })
})

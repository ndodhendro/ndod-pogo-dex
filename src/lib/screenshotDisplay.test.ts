import { describe, expect, it } from 'vitest'
import { screenshotCssSize } from './screenshotDisplay'

describe('screenshotCssSize', () => {
  it('keeps 1:1 CSS pixels on a 1× display', () => {
    expect(screenshotCssSize(1080, 2340, 1)).toEqual({ width: 1080, height: 2340 })
  })

  it('matches the original screenshot on a 3× phone', () => {
    expect(screenshotCssSize(1080, 1039, 3)).toEqual({ width: 360, height: 1039 / 3 })
  })

  it('treats a missing or invalid ratio as 1×', () => {
    expect(screenshotCssSize(738, 710, 0)).toEqual({ width: 738, height: 710 })
    expect(screenshotCssSize(738, 710, Number.NaN)).toEqual({ width: 738, height: 710 })
  })
})

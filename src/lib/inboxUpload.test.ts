import { describe, expect, it } from 'vitest'
import { untaggedRemainingLabel } from './inboxUpload'

describe('untaggedRemainingLabel', () => {
  it('shows current/target while screenshots are being added', () => {
    expect(untaggedRemainingLabel(4, { current: 3, total: 10 })).toBe('3/10 remaining')
    expect(untaggedRemainingLabel(1200, { current: 12, total: 1500 })).toBe('12/1,500 remaining')
  })

  it('shows the inbox total once adding finishes', () => {
    expect(untaggedRemainingLabel(10, null)).toBe('10 remaining')
    expect(untaggedRemainingLabel(1500)).toBe('1,500 remaining')
  })
})

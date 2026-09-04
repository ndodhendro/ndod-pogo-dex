import { describe, expect, it } from 'vitest'
import { newId, uuidFromBytes } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('newId', () => {
  it('returns a UUID v4', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('works when randomUUID is missing', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined })
    try {
      expect(newId()).toMatch(UUID_V4)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: original })
    }
  })
})

describe('uuidFromBytes', () => {
  it('sets version and variant bits', () => {
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000')
  })
})

import { describe, expect, it } from 'vitest'
import { hashBlob, sha256Bytes } from './hash'

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function hex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('sha256Bytes', () => {
  it('matches the empty and abc test vectors', () => {
    expect(hex(sha256Bytes(new Uint8Array()))).toBe(EMPTY)
    expect(hex(sha256Bytes(new TextEncoder().encode('abc')))).toBe(ABC)
  })
})

describe('hashBlob', () => {
  it('hashes when Web Crypto subtle is missing', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle')
    Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: undefined })
    try {
      expect(await hashBlob(new Blob(['abc']))).toBe(ABC)
    } finally {
      if (original) Object.defineProperty(globalThis.crypto, 'subtle', original)
      else delete (globalThis.crypto as { subtle?: SubtleCrypto }).subtle
    }
  })
})

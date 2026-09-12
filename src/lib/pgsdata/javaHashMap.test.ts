import { describe, expect, it } from 'vitest'
import { packJavaHashMap, parseJavaHashMap, type HashMapPayload } from './javaHashMap'

const DEFAULT_SUIDS: Record<string, bigint> = {
  'java.util.HashMap': 0x0507dac1c31660d1n,
  'java.lang.Integer': 0x12e2a0a4f7818738n,
  'java.lang.Boolean': 0xcd207280d59cfaeen,
  'java.lang.Number': 0x86ac951d0b94e08bn,
  'java.lang.Float': 0xdaedc9a2db3cf0ecn,
  'java.lang.Long': 0x3b8be490cc8f23dfn,
}

function payload(entries: HashMapPayload['entries']): HashMapPayload {
  return {
    loadFactor: 0.75,
    threshold: 12,
    buckets: 16,
    order: Object.keys(entries),
    entries,
    suids: DEFAULT_SUIDS,
  }
}

describe('javaHashMap', () => {
  it('round-trips boxed primitives and strings', () => {
    const src = payload({
      count: { type: 'int', value: 7 },
      flag: { type: 'bool', value: false },
      ready: { type: 'bool', value: true },
      speed: { type: 'float', value: 2 },
      when: { type: 'long', value: 1789119272113 },
      hlfeeds: {
        type: 'string',
        value: '[{"name":"Basic 001","pokemons":[1,2,3]}]',
      },
    })
    const packed = packJavaHashMap(src)
    expect(packed[0]).toBe(0xac)
    expect(packed[1]).toBe(0xed)
    const out = parseJavaHashMap(packed)
    expect(out.order).toEqual(src.order)
    expect(out.entries).toEqual(src.entries)
    expect(out.loadFactor).toBeCloseTo(0.75)
  })

  it('rejects a non-Java file', () => {
    expect(() => parseJavaHashMap(new TextEncoder().encode('not a dat'))).toThrow(
      /not a Java serialized stream/,
    )
  })
})

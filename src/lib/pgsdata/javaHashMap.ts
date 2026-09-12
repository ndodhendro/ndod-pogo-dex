/** Java Object Serialization of HashMap<String, boxed primitive | String>. */

export class JavaStreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JavaStreamError'
  }
}

const STREAM_MAGIC = 0xaced
const STREAM_VERSION = 5
const TC_NULL = 0x70
const TC_REFERENCE = 0x71
const TC_CLASSDESC = 0x72
const TC_OBJECT = 0x73
const TC_STRING = 0x74
const TC_BLOCKDATA = 0x77
const TC_ENDBLOCKDATA = 0x78
const TC_LONGSTRING = 0x7c
const BASE_WIRE_HANDLE = 0x7e0000
const SC_WRITE_METHOD = 0x01
const SC_SERIALIZABLE = 0x02

const DEFAULT_SUIDS: Record<string, bigint> = {
  'java.util.HashMap': 0x0507dac1c31660d1n,
  'java.lang.Integer': 0x12e2a0a4f7818738n,
  'java.lang.Boolean': 0xcd207280d59cfaeen,
  'java.lang.Number': 0x86ac951d0b94e08bn,
  'java.lang.Float': 0xdaedc9a2db3cf0ecn,
  'java.lang.Long': 0x3b8be490cc8f23dfn,
}

export type TypedValue =
  | { type: 'int'; value: number }
  | { type: 'long'; value: number }
  | { type: 'float'; value: number }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }

export type HashMapPayload = {
  loadFactor: number
  threshold: number
  buckets: number
  order: string[]
  entries: Record<string, TypedValue>
  suids: Record<string, bigint>
}

type ClassDesc = {
  name: string
  suid: bigint
  flags: number
  fields: { code: string; name: string }[]
  super: ClassDesc | null
}

function toUnsigned64(value: bigint) {
  return value < 0n ? value + (1n << 64n) : value
}

function toSigned64(value: bigint) {
  return value >= 1n << 63n ? value - (1n << 64n) : value
}

function decodeModifiedUtf8(raw: Uint8Array) {
  let out = ''
  let i = 0
  while (i < raw.length) {
    const b1 = raw[i]
    if (b1 === 0) throw new JavaStreamError('embedded NUL in modified UTF-8')
    if (b1 < 0x80) {
      out += String.fromCharCode(b1)
      i += 1
      continue
    }
    if ((b1 & 0xe0) === 0xc0) {
      const b2 = raw[i + 1]
      out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f))
      i += 2
      continue
    }
    if ((b1 & 0xf0) === 0xe0) {
      const b2 = raw[i + 1]
      const b3 = raw[i + 2]
      out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f))
      i += 3
      continue
    }
    throw new JavaStreamError(`bad modified UTF-8 byte ${b1}`)
  }
  return out
}

export function encodeModifiedUtf8(text: string) {
  const out: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 0) {
      out.push(0xc0, 0x80)
    } else if (code <= 0x7f) {
      out.push(code)
    } else if (code <= 0x7ff) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code <= 0xffff) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      const u = code - 0x10000
      const hi = 0xd800 | (u >> 10)
      const lo = 0xdc00 | (u & 0x3ff)
      for (const unit of [hi, lo]) {
        out.push(0xe0 | (unit >> 12), 0x80 | ((unit >> 6) & 0x3f), 0x80 | (unit & 0x3f))
      }
    }
  }
  return Uint8Array.from(out)
}

class JavaReader {
  pos = 0
  handles: unknown[] = []

  constructor(private readonly data: Uint8Array) {}

  remaining() {
    return this.data.length - this.pos
  }

  private view() {
    return new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength)
  }

  u1() {
    if (this.pos >= this.data.length) throw new JavaStreamError('unexpected EOF')
    return this.data[this.pos++]
  }

  u2() {
    const v = this.view().getUint16(this.pos)
    this.pos += 2
    return v
  }

  u4() {
    const v = this.view().getUint32(this.pos)
    this.pos += 4
    return v
  }

  i4() {
    const v = this.view().getInt32(this.pos)
    this.pos += 4
    return v
  }

  i8() {
    const v = this.view().getBigInt64(this.pos)
    this.pos += 8
    return v
  }

  f4() {
    const v = this.view().getFloat32(this.pos)
    this.pos += 4
    return v
  }

  bytes(n: number) {
    const chunk = this.data.subarray(this.pos, this.pos + n)
    if (chunk.length !== n) throw new JavaStreamError('unexpected EOF')
    this.pos += n
    return chunk
  }

  newHandle<T>(obj: T) {
    this.handles.push(obj)
    return obj
  }

  utf(length: number) {
    return decodeModifiedUtf8(this.bytes(length))
  }

  readStream() {
    const magic = this.u2()
    const version = this.u2()
    if (magic !== STREAM_MAGIC || version !== STREAM_VERSION) {
      throw new JavaStreamError(`not a Java serialized stream (magic=${magic.toString(16)} ver=${version})`)
    }
    return this.readContent()
  }

  readContent() {
    return this.readContentTc(this.u1())
  }

  readContentTc(tc: number): unknown {
    if (tc === TC_NULL) return null
    if (tc === TC_REFERENCE) {
      const handle = this.u4()
      const idx = handle - BASE_WIRE_HANDLE
      if (idx < 0 || idx >= this.handles.length) throw new JavaStreamError(`bad handle ${handle.toString(16)}`)
      return this.handles[idx]
    }
    if (tc === TC_STRING) return this.newHandle(this.utf(this.u2()))
    if (tc === TC_LONGSTRING) {
      const n = Number(this.i8())
      if (n < 0 || n > 10_000_000) throw new JavaStreamError('implausible long string')
      return this.newHandle(this.utf(n))
    }
    if (tc === TC_CLASSDESC) return this.readClassDescBody()
    if (tc === TC_OBJECT) return this.readNewObject()
    throw new JavaStreamError(`unsupported type code ${tc.toString(16)} at ${this.pos - 1}`)
  }

  readClassDesc(): ClassDesc | null {
    const tc = this.u1()
    if (tc === TC_NULL) return null
    if (tc === TC_REFERENCE) return this.readContentTc(tc) as ClassDesc
    if (tc === TC_CLASSDESC) return this.readClassDescBody()
    throw new JavaStreamError(`expected classDesc, got ${tc.toString(16)}`)
  }

  readClassDescBody() {
    const name = this.utf(this.u2())
    const suid = toUnsigned64(this.i8())
    const desc: ClassDesc = { name, suid, flags: 0, fields: [], super: null }
    this.newHandle(desc)
    desc.flags = this.u1()
    const nfields = this.u2()
    for (let i = 0; i < nfields; i++) {
      const code = String.fromCharCode(this.u1())
      const fname = this.utf(this.u2())
      if (code === 'L' || code === '[') this.readContent()
      desc.fields.push({ code, name: fname })
    }
    while (true) {
      const tc = this.u1()
      if (tc === TC_ENDBLOCKDATA) break
      this.readContentTc(tc)
    }
    desc.super = this.readClassDesc()
    return desc
  }

  readNewObject() {
    const desc = this.readClassDesc()
    if (!desc) throw new JavaStreamError('object without classDesc')
    const obj: Record<string, unknown> = { __class__: desc.name }
    const handleIdx = this.handles.length
    this.newHandle(obj)
    this.readClassData(desc, obj)
    const unwrapped = unwrapBoxed(obj)
    this.handles[handleIdx] = unwrapped
    return unwrapped
  }

  readClassData(desc: ClassDesc, obj: Record<string, unknown>) {
    for (const c of classChain(desc)) {
      for (const field of c.fields) obj[field.name] = this.readField(field.code)
      if (c.flags & SC_WRITE_METHOD) this.readOptionalData(c, obj)
    }
  }

  readField(code: string) {
    if (code === 'I') return this.i4()
    if (code === 'F') return this.f4()
    if (code === 'J') return Number(this.i8())
    if (code === 'Z') return this.u1() !== 0
    if (code === 'L' || code === '[') return this.readContent()
    throw new JavaStreamError(`unsupported field code ${code}`)
  }

  readOptionalData(desc: ClassDesc, obj: Record<string, unknown>) {
    if (desc.name === 'java.util.HashMap') {
      this.readHashMapData(obj)
      return
    }
    while (true) {
      const tc = this.u1()
      if (tc === TC_ENDBLOCKDATA) return
      if (tc === TC_BLOCKDATA) {
        this.bytes(this.u1())
        continue
      }
      this.readContentTc(tc)
    }
  }

  readHashMapData(obj: Record<string, unknown>) {
    const tc = this.u1()
    if (tc !== TC_BLOCKDATA) throw new JavaStreamError(`HashMap expected blockdata, got ${tc.toString(16)}`)
    const n = this.u1()
    if (n !== 8) throw new JavaStreamError(`HashMap blockdata length ${n}, expected 8`)
    const buckets = this.i4()
    const size = this.i4()
    const entries: Record<string, TypedValue> = {}
    const order: string[] = []
    for (let i = 0; i < size; i++) {
      const key = this.readContent()
      const value = this.readContent()
      if (typeof key !== 'string') throw new JavaStreamError('non-string HashMap key')
      entries[key] = toTypedValue(key, value)
      order.push(key)
    }
    const end = this.u1()
    if (end !== TC_ENDBLOCKDATA) throw new JavaStreamError('HashMap missing TC_ENDBLOCKDATA')
    obj.__buckets__ = buckets
    obj.__size__ = size
    obj.__order__ = order
    obj.__entries__ = entries
  }
}

function classChain(desc: ClassDesc) {
  const chain: ClassDesc[] = []
  let cur: ClassDesc | null = desc
  while (cur) {
    chain.push(cur)
    cur = cur.super
  }
  chain.reverse()
  return chain
}

function unwrapBoxed(obj: Record<string, unknown>) {
  const name = obj.__class__
  if (name === 'java.lang.Integer') return { type: 'int' as const, value: Number(obj.value) }
  if (name === 'java.lang.Long') return { type: 'long' as const, value: Number(obj.value) }
  if (name === 'java.lang.Float') return { type: 'float' as const, value: Number(obj.value) }
  if (name === 'java.lang.Boolean') return { type: 'bool' as const, value: Boolean(obj.value) }
  return obj
}

function toTypedValue(key: string, value: unknown): TypedValue {
  if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
    return value as TypedValue
  }
  if (typeof value === 'string') return { type: 'string', value }
  throw new JavaStreamError(`unsupported value for ${key}`)
}

class JavaWriter {
  private buf = new Uint8Array(256)
  private pos = 0
  private handleCount = 0
  private classHandles = new Map<string, number>()
  private stringHandles = new Map<string, number>()

  constructor(private readonly suids: Record<string, bigint>) {}

  private ensure(n: number) {
    if (this.pos + n <= this.buf.length) return
    let cap = this.buf.length
    while (cap < this.pos + n) cap *= 2
    const next = new Uint8Array(cap)
    next.set(this.buf.subarray(0, this.pos))
    this.buf = next
  }

  private view() {
    return new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)
  }

  bytes() {
    return this.buf.slice(0, this.pos)
  }

  u1(v: number) {
    this.ensure(1)
    this.buf[this.pos++] = v & 0xff
  }

  u2(v: number) {
    this.ensure(2)
    this.view().setUint16(this.pos, v)
    this.pos += 2
  }

  u4(v: number) {
    this.ensure(4)
    this.view().setUint32(this.pos, v)
    this.pos += 4
  }

  i4(v: number) {
    this.ensure(4)
    this.view().setInt32(this.pos, v)
    this.pos += 4
  }

  i8(v: bigint) {
    this.ensure(8)
    this.view().setBigInt64(this.pos, toSigned64(v))
    this.pos += 8
  }

  f4(v: number) {
    this.ensure(4)
    this.view().setFloat32(this.pos, v)
    this.pos += 4
  }

  writeRaw(raw: Uint8Array) {
    this.ensure(raw.length)
    this.buf.set(raw, this.pos)
    this.pos += raw.length
  }

  nextHandle() {
    const h = this.handleCount
    this.handleCount += 1
    return h
  }

  suid(name: string) {
    return this.suids[name] ?? DEFAULT_SUIDS[name] ?? 0n
  }

  writeUtfBody(text: string) {
    const raw = encodeModifiedUtf8(text)
    if (raw.length > 65535) throw new JavaStreamError(`string too long for TC_STRING (${raw.length} bytes)`)
    this.u2(raw.length)
    this.writeRaw(raw)
  }

  writeString(text: string) {
    const existing = this.stringHandles.get(text)
    if (existing !== undefined) {
      this.u1(TC_REFERENCE)
      this.u4(BASE_WIRE_HANDLE + existing)
      return
    }
    this.u1(TC_STRING)
    this.stringHandles.set(text, this.nextHandle())
    this.writeUtfBody(text)
  }

  writeClassDesc(
    name: string,
    flags: number,
    fields: [string, string][],
    superName: string | null,
  ) {
    const existing = this.classHandles.get(name)
    if (existing !== undefined) {
      this.u1(TC_REFERENCE)
      this.u4(BASE_WIRE_HANDLE + existing)
      return
    }
    this.u1(TC_CLASSDESC)
    this.classHandles.set(name, this.nextHandle())
    const rawName = encodeModifiedUtf8(name)
    this.u2(rawName.length)
    this.writeRaw(rawName)
    this.i8(this.suid(name))
    this.u1(flags)
    this.u2(fields.length)
    for (const [code, fname] of fields) {
      this.u1(code.charCodeAt(0))
      const rawF = encodeModifiedUtf8(fname)
      this.u2(rawF.length)
      this.writeRaw(rawF)
    }
    this.u1(TC_ENDBLOCKDATA)
    if (superName === 'java.lang.Number') {
      this.writeClassDesc('java.lang.Number', SC_SERIALIZABLE, [], null)
    } else if (superName === null) {
      this.u1(TC_NULL)
    } else {
      throw new JavaStreamError(`unsupported superclass ${superName}`)
    }
  }

  writeBoxedInt(value: number) {
    this.u1(TC_OBJECT)
    this.writeClassDesc('java.lang.Integer', SC_SERIALIZABLE, [['I', 'value']], 'java.lang.Number')
    this.nextHandle()
    this.i4(value)
  }

  writeBoxedLong(value: number) {
    this.u1(TC_OBJECT)
    this.writeClassDesc('java.lang.Long', SC_SERIALIZABLE, [['J', 'value']], 'java.lang.Number')
    this.nextHandle()
    this.i8(BigInt(value))
  }

  writeBoxedFloat(value: number) {
    this.u1(TC_OBJECT)
    this.writeClassDesc('java.lang.Float', SC_SERIALIZABLE, [['F', 'value']], 'java.lang.Number')
    this.nextHandle()
    this.f4(value)
  }

  writeBoxedBool(value: boolean) {
    this.u1(TC_OBJECT)
    this.writeClassDesc('java.lang.Boolean', SC_SERIALIZABLE, [['Z', 'value']], null)
    this.nextHandle()
    this.u1(value ? 1 : 0)
  }

  writeValue(typed: TypedValue) {
    if (typed.type === 'int') this.writeBoxedInt(typed.value)
    else if (typed.type === 'long') this.writeBoxedLong(typed.value)
    else if (typed.type === 'float') this.writeBoxedFloat(typed.value)
    else if (typed.type === 'bool') this.writeBoxedBool(typed.value)
    else {
      const raw = encodeModifiedUtf8(typed.value)
      if (raw.length <= 65535) {
        this.writeString(typed.value)
        return
      }
      this.u1(TC_LONGSTRING)
      this.stringHandles.set(typed.value, this.nextHandle())
      this.i8(BigInt(raw.length))
      this.writeRaw(raw)
    }
  }

  writeHashMap(payload: HashMapPayload) {
    const { entries, order } = payload
    const loadFactor = payload.loadFactor || 0.75
    const size = order.length
    const buckets = payload.buckets || nextPowerOfTwo(Math.max(16, Math.floor(size / loadFactor) + 1))
    const threshold = payload.threshold || Math.floor(buckets * loadFactor)

    this.u2(STREAM_MAGIC)
    this.u2(STREAM_VERSION)
    this.u1(TC_OBJECT)
    this.writeClassDesc(
      'java.util.HashMap',
      SC_SERIALIZABLE | SC_WRITE_METHOD,
      [
        ['F', 'loadFactor'],
        ['I', 'threshold'],
      ],
      null,
    )
    this.nextHandle()
    this.f4(loadFactor)
    this.i4(threshold)
    this.u1(TC_BLOCKDATA)
    this.u1(8)
    this.i4(buckets)
    this.i4(size)
    for (const key of order) {
      const value = entries[key]
      if (!value) throw new JavaStreamError(`order key missing from entries: ${key}`)
      this.writeString(key)
      this.writeValue(value)
    }
    this.u1(TC_ENDBLOCKDATA)
    return this.bytes()
  }
}

function nextPowerOfTwo(n: number) {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function collectSuids(root: Record<string, unknown>, handles: unknown[]) {
  const suids = { ...DEFAULT_SUIDS }
  for (const handle of handles) {
    if (handle && typeof handle === 'object' && 'name' in handle && 'suid' in handle && 'fields' in handle) {
      const desc = handle as ClassDesc
      suids[desc.name] = desc.suid
    }
  }
  void root
  return suids
}

export function parseJavaHashMap(data: Uint8Array): HashMapPayload {
  const reader = new JavaReader(data)
  const obj = reader.readStream() as Record<string, unknown>
  if (!obj || obj.__class__ !== 'java.util.HashMap') throw new JavaStreamError('root object is not a HashMap')
  if (reader.remaining() !== 0) throw new JavaStreamError(`${reader.remaining()} trailing bytes after HashMap`)
  return {
    loadFactor: typeof obj.loadFactor === 'number' ? obj.loadFactor : 0.75,
    threshold: typeof obj.threshold === 'number' ? obj.threshold : 0,
    buckets: obj.__buckets__ as number,
    order: obj.__order__ as string[],
    entries: obj.__entries__ as Record<string, TypedValue>,
    suids: collectSuids(obj, reader.handles),
  }
}

export function packJavaHashMap(payload: HashMapPayload): Uint8Array {
  return new JavaWriter(payload.suids).writeHashMap(payload)
}

export const HLFEEDS_KEY = 'hlfeeds'

/** UUID v4. `crypto.randomUUID` is missing on HTTP LAN hosts (not a secure context). */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to getRandomValues
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return uuidFromBytes(bytes)
}

export function uuidFromBytes(bytes: Uint8Array): string {
  const next = bytes.slice(0, 16)
  next[6] = (next[6] & 0x0f) | 0x40
  next[8] = (next[8] & 0x3f) | 0x80
  const hex = [...next].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  return bytesToHex(await crypto.subtle.digest('SHA-256', buf))
}

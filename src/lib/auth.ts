import { getSupabase } from './supabase'

const SALT_KEY = 'ndod.pin.salt'
const HASH_KEY = 'ndod.pin.hash'
const EMAIL_KEY = 'ndod.auth.email'
const UNLOCKED_KEY = 'ndod.unlocked'
export const IDLE_MS = 5 * 60 * 1000

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return bytesToHex(bytes.buffer)
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  return bytesToHex(await crypto.subtle.digest('SHA-256', data))
}

async function pinPassword(pin: string, salt: string) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return bytesToHex(bits)
}

export function hasPin(): boolean {
  return Boolean(localStorage.getItem(HASH_KEY) && localStorage.getItem(SALT_KEY))
}

export function isUnlocked(): boolean {
  return sessionStorage.getItem(UNLOCKED_KEY) === '1'
}

export function lockApp() {
  sessionStorage.removeItem(UNLOCKED_KEY)
  window.dispatchEvent(new Event('ndod-lock'))
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCKED_KEY, '1')
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = localStorage.getItem(SALT_KEY)
  const hash = localStorage.getItem(HASH_KEY)
  if (!salt || !hash) return false
  return (await sha256(salt + pin)) === hash
}

export async function setupPin(pin: string): Promise<void> {
  const salt = randomSalt()
  localStorage.setItem(SALT_KEY, salt)
  localStorage.setItem(HASH_KEY, await sha256(salt + pin))
  markUnlocked()

  const supabase = getSupabase()
  if (!supabase) return

  let email = localStorage.getItem(EMAIL_KEY)
  if (!email) {
    email = `collector.${crypto.randomUUID()}@pin.ndod-pogo-dex.app`
    localStorage.setItem(EMAIL_KEY, email)
  }
  const password = await pinPassword(pin, salt)
  const { error } = await supabase.auth.signUp({ email, password })
  if (error && !/already/i.test(error.message)) {
    const signIn = await supabase.auth.signInWithPassword({ email, password })
    if (signIn.error) throw new Error(signIn.error.message)
  }
}

export async function unlockWithPin(pin: string): Promise<void> {
  const ok = await verifyPin(pin)
  if (!ok) throw new Error('Wrong PIN')
  markUnlocked()

  const supabase = getSupabase()
  if (!supabase) return
  const email = localStorage.getItem(EMAIL_KEY)
  const salt = localStorage.getItem(SALT_KEY)
  if (!email || !salt) return
  const password = await pinPassword(pin, salt)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // Local PIN is the lock. Cloud session is best-effort.
    console.warn(error.message)
  }
}

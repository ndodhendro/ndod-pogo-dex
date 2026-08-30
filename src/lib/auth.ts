import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

const LEGACY_PIN_KEYS = ['ndod.pin.salt', 'ndod.pin.hash', 'ndod.auth.email'] as const

function clearLegacyPinKeys() {
  for (const key of LEGACY_PIN_KEYS) localStorage.removeItem(key)
  sessionStorage.removeItem('ndod.unlocked')
}

export function isAuthConfigured() {
  return Boolean(getSupabase())
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function subscribeToSession(onSession: (session: Session | null) => void) {
  const supabase = getSupabase()
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) clearLegacyPinKeys()
    onSession(session)
  })
  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Google sign-in needs Supabase')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export function userEmail(user: User | null | undefined) {
  return user?.email ?? null
}

import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isAuthConfigured, signInWithGoogle, subscribeToSession, getSession } from '../lib/auth'
import { backupAllMetadata } from '../lib/sync'
import { useToast } from '../lib/toast'
import styles from './AuthGate.module.css'

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = isAuthConfigured()

  useEffect(() => {
    if (!configured) {
      setReady(true)
      return
    }
    void getSession().then((current) => {
      setSession(current)
      setReady(true)
    })
    return subscribeToSession(setSession)
  }, [configured])

  useEffect(() => {
    if (!session) return
    void backupAllMetadata().then((message) => {
      if (message) showToast(message, 'warning')
    })
  }, [session, showToast])

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in')
    }
  }

  if (!ready) return null
  if (session) return children

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>
          {configured
            ? 'Use Google to open the collection and keep cloud backup on this account.'
            : 'Google sign-in needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'}
        </p>
        <p className={styles.error}>{error ?? ''}</p>
        <button
          type="button"
          className={styles.google}
          disabled={!configured || busy}
          onClick={() => void onGoogle()}
        >
          <GoogleMark />
          {busy ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}

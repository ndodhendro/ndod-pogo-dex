import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PinPad } from './PinPad'
import {
  hasPin,
  IDLE_MS,
  isUnlocked,
  lockApp,
  setupPin,
  unlockWithPin,
} from '../lib/auth'
import { useToast } from '../lib/toast'

export function LockGate({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [mode, setMode] = useState<'setup' | 'confirm' | 'unlock'>('unlock')
  const [pending, setPending] = useState('')
  const [error, setError] = useState<string | null>(null)
  const idleRef = useRef<number>(0)

  useEffect(() => {
    const exists = hasPin()
    setMode(exists ? 'unlock' : 'setup')
    setUnlocked(exists && isUnlocked())
    setReady(true)
  }, [])

  const onLocked = useCallback(() => {
    lockApp()
    setUnlocked(false)
    setMode('unlock')
  }, [])

  useEffect(() => {
    const handler = () => {
      setUnlocked(false)
      setMode('unlock')
    }
    window.addEventListener('ndod-lock', handler)
    return () => window.removeEventListener('ndod-lock', handler)
  }, [])

  const bump = useCallback(() => {
    if (!unlocked) return
    window.clearTimeout(idleRef.current)
    idleRef.current = window.setTimeout(onLocked, IDLE_MS)
  }, [unlocked, onLocked])

  useEffect(() => {
    if (!unlocked) return
    bump()
    const onEvent = () => bump()
    window.addEventListener('pointerdown', onEvent)
    window.addEventListener('keydown', onEvent)
    return () => {
      window.clearTimeout(idleRef.current)
      window.removeEventListener('pointerdown', onEvent)
      window.removeEventListener('keydown', onEvent)
    }
  }, [unlocked, bump])

  if (!ready) return null
  if (unlocked) return children

  if (mode === 'setup' || mode === 'confirm') {
    return (
      <PinPad
        title={mode === 'setup' ? 'Create PIN' : 'Confirm PIN'}
        subtitle="6 digits. This unlocks the app and signs in to Supabase when configured."
        error={error}
        onComplete={(pin) => {
          setError(null)
          if (mode === 'setup') {
            setPending(pin)
            setMode('confirm')
            return
          }
          if (pin !== pending) {
            setError('PIN did not match')
            setPending('')
            setMode('setup')
            return
          }
          void setupPin(pin)
            .then(() => setUnlocked(true))
            .catch((err) => {
              showToast(err instanceof Error ? err.message : 'Cloud sign-in failed; local PIN is set')
              setUnlocked(true)
            })
        }}
      />
    )
  }

  return (
    <PinPad
      title="Unlock"
      subtitle="Enter your PIN"
      error={error}
      onComplete={(pin) => {
        setError(null)
        void unlockWithPin(pin)
          .then(() => setUnlocked(true))
          .catch((err) => setError(err instanceof Error ? err.message : 'Wrong PIN'))
      }}
    />
  )
}

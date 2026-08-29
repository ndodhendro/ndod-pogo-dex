import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

const CHECK_MS = 15 * 60 * 1000

export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<(reload?: boolean) => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined

    const check = () => {
      void registration?.update()
      if (registration?.waiting) setNeedRefresh(true)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_url, reg) {
        registration = reg
        check()
      },
    })

    const interval = window.setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  const reload = useCallback(() => {
    void updateRef.current(true)
  }, [])

  const dismiss = useCallback(() => {
    setNeedRefresh(false)
  }, [])

  return { needRefresh, reload, dismiss }
}

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ToastTone = 'error' | 'warning' | 'success'

export type ToastMessage = {
  id: string
  text: string
  tone: ToastTone
}

type ToastApi = {
  toasts: ToastMessage[]
  showToast: (text: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let toastSeq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (text: string, tone: ToastTone = 'error') => {
      const id = `toast-${Date.now()}-${++toastSeq}`
      setToasts((list) => [...list, { id, text, tone }])
      window.setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast needs ToastProvider')
  return ctx
}

/** Local write succeeded: success toast, unless cloud backup returned a warning. */
export function toastAfterWrite(
  showToast: ToastApi['showToast'],
  success: string,
  cloudError?: string,
) {
  if (cloudError) showToast(cloudError, 'warning')
  else showToast(success, 'success')
}

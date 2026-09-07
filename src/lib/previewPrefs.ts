import { useSyncExternalStore } from 'react'

export const PREVIEW_ANIMATIONS_KEY = 'ndod.previewAnimations'

const listeners = new Set<() => void>()

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export function previewAnimationsEnabled(value: string | null): boolean {
  return value !== '0'
}

export function getPreviewAnimations(): boolean {
  try {
    return previewAnimationsEnabled(memoryStore()?.getItem(PREVIEW_ANIMATIONS_KEY) ?? null)
  } catch {
    return true
  }
}

export function setPreviewAnimations(on: boolean) {
  try {
    memoryStore()?.setItem(PREVIEW_ANIMATIONS_KEY, on ? '1' : '0')
  } catch {
    // private mode / denied storage
  }
  listeners.forEach((fn) => fn())
}

export function subscribePreviewAnimations(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === PREVIEW_ANIMATIONS_KEY || event.key === null) {
      listeners.forEach((fn) => fn())
    }
  })
}

export function usePreviewAnimations() {
  return useSyncExternalStore(subscribePreviewAnimations, getPreviewAnimations, () => true)
}

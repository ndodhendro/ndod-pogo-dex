/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown }

precacheAndRoute(self.__WB_MANIFEST as Parameters<typeof precacheAndRoute>[0])
cleanupOutdatedCaches()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

const SHARE_DB_NAME = 'ndod-pogo-dex-share'
const SHARE_STORE = 'pending'

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SHARE_STORE)) {
        req.result.createObjectStore(SHARE_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function handleShareTarget(request: Request) {
  const form = await request.formData()
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    const shareDb = await openShareDb()
    await new Promise<void>((resolve, reject) => {
      const tx = shareDb.transaction(SHARE_STORE, 'readwrite')
      tx.objectStore(SHARE_STORE).put({
        id: crypto.randomUUID(),
        blob: file,
        createdAt: Date.now(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    shareDb.close()
  }
  return Response.redirect('/inbox', 303)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(event.request))
  }
})

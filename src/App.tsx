import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LockGate } from './components/LockGate'
import { Toast } from './components/Toast'
import { UpdatePrompt } from './components/UpdatePrompt'
import { DexPage } from './pages/Dex'
import { GalleryPage } from './pages/Gallery'
import { InboxPage } from './pages/Inbox'
import { SettingsPage } from './pages/Settings'

export function App() {
  return (
    <>
      <Toast />
      <UpdatePrompt />
      <LockGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dex" replace />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/dex" element={<DexPage />} />
            <Route path="/dex/:categoryId" element={<DexPage />} />
            <Route path="/dex/:categoryId/species/:speciesId" element={<GalleryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </LockGate>
    </>
  )
}

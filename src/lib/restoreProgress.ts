export type RestorePhase =
  | 'picking'
  | 'reading'
  | 'hashing'
  | 'loading'
  | 'downloading'
  | 'writing'
  | 'inbox'

export type RestoreProgress = {
  phase: RestorePhase
  current: number
  total: number
}

export function restoreProgressPercent(progress: RestoreProgress) {
  if (!Number.isFinite(progress.current) || !Number.isFinite(progress.total) || progress.total <= 0) {
    return 0
  }
  if (progress.current >= progress.total) return 100
  return Math.min(99, Math.max(0, Math.round((progress.current / progress.total) * 100)))
}

export function formatRestoreProgressPercent(progress: RestoreProgress) {
  return `${restoreProgressPercent(progress)}%`
}

function withPercent(label: string, progress: RestoreProgress) {
  return `${label} (${formatRestoreProgressPercent(progress)})`
}

export function restoreProgressLabel(progress: RestoreProgress) {
  if (progress.phase === 'picking') return withPercent('Choose the Screenshots folder…', progress)
  if (progress.phase === 'reading') {
    if (progress.total > 0) {
      return withPercent(`Reading photos ${progress.current} / ${progress.total}`, progress)
    }
    if (progress.current > 0) {
      return withPercent(`Looking through folder… ${progress.current}`, progress)
    }
    return withPercent('Reading photos from the folder…', progress)
  }
  if (progress.phase === 'hashing') {
    return withPercent(`Hashing photos ${progress.current} / ${progress.total}`, progress)
  }
  if (progress.phase === 'loading') return withPercent('Loading cloud metadata…', progress)
  if (progress.phase === 'downloading') {
    return withPercent(`Downloading ${progress.current} / ${progress.total}`, progress)
  }
  if (progress.phase === 'inbox') {
    return withPercent(`Sending to Transfer ${progress.current} / ${progress.total}`, progress)
  }
  return withPercent(`Restoring ${progress.current} / ${progress.total}`, progress)
}

export function restoreBusyLabel(progress: RestoreProgress) {
  if (progress.phase === 'picking') return 'Choose folder…'
  if (progress.phase === 'reading') return 'Reading…'
  if (progress.phase === 'hashing') return 'Hashing…'
  if (progress.phase === 'loading') return 'Loading…'
  if (progress.phase === 'downloading') return 'Downloading…'
  if (progress.phase === 'inbox') return 'Transfer…'
  return 'Restoring…'
}

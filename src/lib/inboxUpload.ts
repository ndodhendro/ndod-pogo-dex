export type InboxAddProgress = {
  current: number
  total: number
}

/** `3/10 remaining` while files are being added; the inbox total once that finishes. */
export function untaggedRemainingLabel(count: number, progress?: InboxAddProgress | null) {
  if (progress && progress.total > 0) {
    const current = progress.current.toLocaleString('en-US')
    const total = progress.total.toLocaleString('en-US')
    return `${current}/${total} remaining`
  }
  return `${count.toLocaleString('en-US')} remaining`
}

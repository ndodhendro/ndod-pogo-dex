import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export const SPECIMEN_BUCKET = 'specimens'

export function extensionForBlob(blob: Blob | undefined): string {
  const type = blob?.type ?? ''
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

/** Private object key: `{auth.uid()}/{fileHash}.ext` — matches storage RLS. */
export function specimenObjectPath(userId: string, fileHash: string, blob?: Blob): string {
  return `${userId}/${fileHash}.${extensionForBlob(blob)}`
}

export function isStorageAlreadyExistsError(error: {
  statusCode?: string | number | null
  message?: string | null
} | null): boolean {
  if (!error) return false
  if (String(error.statusCode ?? '') === '409') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('already exists') || message.includes('duplicate')
}

export function storageErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('not exist'))) {
    return 'Create the private Storage bucket "specimens" in the Supabase dashboard, then try again.'
  }
  if (lower.includes('row-level security') || lower.includes('row level security')) {
    return 'Screenshot upload blocked by Storage RLS. Run 009_specimen_storage_rls.sql in the Supabase SQL editor, then try again.'
  }
  return message
}

export function specimenNeedsPhotoUpload(cloudImagePath: string | null | undefined): boolean {
  return !cloudImagePath
}

async function signedInUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function uploadSpecimenOriginal(
  supabase: SupabaseClient,
  userId: string,
  fileHash: string,
  blob: Blob,
): Promise<{ path: string } | { error: string }> {
  const path = specimenObjectPath(userId, fileHash, blob)
  const { error } = await supabase.storage.from(SPECIMEN_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error && !isStorageAlreadyExistsError(error)) {
    return { error: storageErrorMessage(error.message) }
  }
  return { path }
}

export async function downloadSpecimenOriginal(
  supabase: SupabaseClient,
  imagePath: string,
): Promise<{ blob: Blob } | { error: string }> {
  const { data, error } = await supabase.storage.from(SPECIMEN_BUCKET).download(imagePath)
  if (error || !data) {
    return { error: storageErrorMessage(error?.message ?? 'Could not download screenshot') }
  }
  return { blob: data }
}

export async function removeSpecimenPhoto(fileHash: string): Promise<string | undefined> {
  const supabase = getSupabase()
  if (!supabase || !fileHash) return
  const userId = await signedInUserId(supabase)
  if (!userId) return
  const { error } = await supabase.storage
    .from(SPECIMEN_BUCKET)
    .remove([specimenObjectPath(userId, fileHash)])
  if (error) return storageErrorMessage(error.message)
}

export async function removeSpecimenObject(
  supabase: SupabaseClient,
  imagePath: string | null | undefined,
): Promise<string | undefined> {
  if (!imagePath) return
  const { error } = await supabase.storage.from(SPECIMEN_BUCKET).remove([imagePath])
  if (error) return storageErrorMessage(error.message)
}

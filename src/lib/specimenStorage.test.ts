import { describe, expect, it } from 'vitest'
import {
  extensionForBlob,
  isStorageAlreadyExistsError,
  specimenNeedsPhotoUpload,
  specimenObjectPath,
  storageErrorMessage,
} from './specimenStorage'

describe('specimenObjectPath', () => {
  it('uses the user id folder and file hash, jpeg by default', () => {
    expect(specimenObjectPath('user-1', 'abc123')).toBe('user-1/abc123.jpg')
  })

  it('keeps png/webp extensions when the blob reports them', () => {
    expect(specimenObjectPath('user-1', 'abc', new Blob([], { type: 'image/png' }))).toBe(
      'user-1/abc.png',
    )
    expect(specimenObjectPath('user-1', 'abc', new Blob([], { type: 'image/webp' }))).toBe(
      'user-1/abc.webp',
    )
  })
})

describe('extensionForBlob', () => {
  it('defaults to jpg', () => {
    expect(extensionForBlob(undefined)).toBe('jpg')
    expect(extensionForBlob(new Blob([], { type: 'image/jpeg' }))).toBe('jpg')
  })
})

describe('isStorageAlreadyExistsError', () => {
  it('treats 409 / already exists as a successful retry', () => {
    expect(isStorageAlreadyExistsError({ statusCode: '409', message: 'Duplicate' })).toBe(true)
    expect(isStorageAlreadyExistsError({ statusCode: 409, message: '' })).toBe(true)
    expect(isStorageAlreadyExistsError({ message: 'The resource already exists' })).toBe(true)
    expect(isStorageAlreadyExistsError({ message: 'Bucket not found' })).toBe(false)
  })
})

describe('storageErrorMessage', () => {
  it('explains a missing specimens bucket', () => {
    expect(storageErrorMessage('Bucket not found')).toBe(
      'Create the private Storage bucket "specimens" in the Supabase dashboard, then try again.',
    )
  })

  it('explains a storage RLS block', () => {
    expect(storageErrorMessage('new row violates row-level security policy')).toBe(
      'Screenshot upload blocked by Storage RLS. Run 009_specimen_storage_rls.sql in the Supabase SQL editor, then try again.',
    )
  })

  it('passes through other errors', () => {
    expect(storageErrorMessage('JWT expired')).toBe('JWT expired')
  })
})

describe('specimenNeedsPhotoUpload', () => {
  it('is true when the cloud row has no storage path', () => {
    expect(specimenNeedsPhotoUpload(null)).toBe(true)
    expect(specimenNeedsPhotoUpload('')).toBe(true)
    expect(specimenNeedsPhotoUpload('user/hash.jpg')).toBe(false)
  })
})

import type { FirebaseStorage } from 'firebase/storage'
import { USING_AUTH_EMULATOR } from './firebase'

/**
 * Cloud Storage, used by STAFF only.
 *
 * Two kinds of object live here — team assets (logos) and mission target
 * photos — and both are public to read, because fans are anonymous and their
 * app has to render them. Writes require the `admin` claim; see storage.rules.
 *
 * Fan captures are NEVER uploaded. They go in the body of the verify request
 * and are discarded with it. Photographs taken by children in a public venue
 * are not something to accumulate: what you do not store cannot leak.
 *
 * Every import is dynamic, for the same reason as firebase/auth — a fan must
 * not download the Storage SDK to look at a hunt.
 */

let storagePromise: Promise<FirebaseStorage> | null = null

function getStorageInstance(): Promise<FirebaseStorage> {
  if (storagePromise) return storagePromise

  storagePromise = (async () => {
    const { getApp } = await import('firebase/app')
    const { getStorage, connectStorageEmulator } = await import('firebase/storage')
    // getFirebaseAuth() has already called initializeApp by the time any
    // staff-only screen can upload, so reuse that app rather than making a
    // second one with the same config.
    const storage = getStorage(getApp())

    if (USING_AUTH_EMULATOR) {
      // Routed through the dev-server proxy (see vite.config.ts), not a
      // direct 127.0.0.1:9199, so it works from a phone on the tailnet and
      // avoids mixed content under https. Same reasoning as the Auth
      // emulator — that one cost an afternoon.
      connectStorageEmulator(storage, window.location.hostname, Number(window.location.port))
    }

    return storage
  })()

  return storagePromise
}

export type AssetKind = 'team-asset' | 'mission-target'

function pathFor(kind: AssetKind, ownerId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
  const stamp = Date.now()
  return kind === 'team-asset'
    ? `tenants/${ownerId}/assets/${stamp}-${safe}`
    : `campaigns/${ownerId}/targets/${stamp}-${safe}`
}

export interface UploadResult {
  url: string
  path: string
}

/**
 * Uploads one image and returns its public download URL.
 *
 * Throws on failure — unlike apiFetch, because every caller here is a staff
 * member looking at a form who needs to be told the upload did not happen.
 */
export async function uploadImage(
  kind: AssetKind,
  ownerId: string,
  file: File,
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }
  // Mirrors the 5 MB cap in storage.rules. Checking here too means the staff
  // member gets a sentence instead of an opaque permission error.
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Images must be under 5 MB.')
  }

  const storage = await getStorageInstance()
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')

  const path = pathFor(kind, ownerId, file.name)
  const objectRef = ref(storage, path)

  await uploadBytes(objectRef, file, { contentType: file.type })
  return { url: await getDownloadURL(objectRef), path }
}

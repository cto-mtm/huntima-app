import type { FirebaseStorage } from 'firebase/storage'
import { USING_AUTH_EMULATOR } from './firebase'
import { compressImage, TARGET_MAX_BYTES } from './image'

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
      // direct 127.0.0.1:10199, so it works from a phone on the tailnet and
      // avoids mixed content under https. Same reasoning as the Auth
      // emulator — that one cost an afternoon.
      // window.location.port is "" on a default port (443 under the https
      // tunnel, 80 plain) and Number("") is 0 — which points the SDK at
      // host:0 and fails every upload. Fall back to the protocol default so
      // the same-origin /v0 proxy is hit. Auth sidesteps this by taking a
      // full origin; connectStorageEmulator only takes host/port.
      const emulatorPort = window.location.port
        ? Number(window.location.port)
        : window.location.protocol === 'https:'
          ? 443
          : 80
      connectStorageEmulator(storage, window.location.hostname, emulatorPort)

      // connectStorageEmulator hardcodes _protocol to 'http' (it only picks
      // 'https' for a Firebase Studio cloud-workstation host) and, unlike
      // connectAuthEmulator, takes host/port separately with no way to pass a
      // scheme. Under the tailnet https tunnel that makes every upload a
      // blocked mixed-content request. Match the page's protocol instead —
      // the proxy serves Storage on the same origin, so https page ⇒ https
      // emulator. _protocol isn't in the public type; this cast is the seam.
      ;(storage as unknown as { _protocol: string })._protocol =
        window.location.protocol === 'https:' ? 'https' : 'http'
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

/** Swaps a file name's extension to match the content type we actually store,
 *  so a JPEG re-encode of `logo.png` is not saved as `logo.png`. */
function withExtensionFor(fileName: string, contentType: string): string {
  const ext =
    contentType === 'image/jpeg'
      ? 'jpg'
      : contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/svg+xml'
            ? 'svg'
            : null
  if (!ext) return fileName
  const base = fileName.replace(/\.[^./\\]+$/, '')
  return `${base}.${ext}`
}

export interface UploadResult {
  url: string
  path: string
}

/**
 * Uploads one image and returns its public download URL.
 *
 * Raster images are compressed client-side to stay under 1 MB before they
 * ever leave the phone — a phone photo is easily 4–8 MB, which is slow on a
 * concourse and wasteful for a logo or a target thumbnail. SVGs are uploaded
 * as-is: they are vector (tiny already) and rasterizing them through a canvas
 * would throw away the very scalability that makes them worth using.
 *
 * PNGs keep their format so transparency (a logo on no background) survives;
 * everything else is re-encoded as JPEG, which compresses photos far better.
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

  const storage = await getStorageInstance()
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')

  // Decide what actually gets uploaded.
  let body: Blob = file
  let contentType = file.type

  const isSvg = file.type === 'image/svg+xml'
  if (!isSvg && file.size > TARGET_MAX_BYTES) {
    // Keep alpha for PNGs; re-encode everything else as JPEG.
    const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const compressed = await compressImage(file, {
      maxBytes: TARGET_MAX_BYTES,
      mimeType: outMime,
    })
    body = compressed.blob
    contentType = compressed.mimeType
  } else if (!isSvg && file.size > 5 * 1024 * 1024) {
    // Only reachable if compression somehow could not run; the rules cap is
    // 5 MB, so surface a clear sentence rather than an opaque permission error.
    throw new Error('Images must be under 5 MB.')
  }

  const path = pathFor(kind, ownerId, withExtensionFor(file.name, contentType))
  const objectRef = ref(storage, path)

  await uploadBytes(objectRef, body, { contentType })
  return { url: await getDownloadURL(objectRef), path }
}

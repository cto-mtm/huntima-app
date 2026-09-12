/**
 * Client-side image downscaling and compression, done before anything is
 * uploaded.
 *
 * A modern phone camera produces a 12 MP, 4–8 MB JPEG. Sending that over
 * stadium wifi, from inside a concrete bowl shared with 30,000 other phones,
 * fails long before a model ever sees it — and the model gains nothing from
 * the extra pixels. 1024px on the long edge is plenty to tell a bronze statue
 * from a soda cup.
 *
 * Also strips EXIF as a side effect of going through a canvas, which removes
 * the GPS coordinates phones embed by default. Given these are photographs
 * taken by children, not attaching their precise location to an upload is
 * worth having happen automatically rather than by discipline.
 */

/** Hard ceiling for an uploaded/posted image, in bytes. */
export const TARGET_MAX_BYTES = 1024 * 1024 // 1 MB

export interface PreparedImage {
  /** Bare base64, no data: prefix — matches verifyCaptureSchema. */
  base64: string
  mimeType: 'image/jpeg'
  /** Object URL for on-screen preview. Revoke when done. */
  previewUrl: string
  width: number
  height: number
}

const MAX_EDGE = 1024

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

/** Draws an image onto a canvas at the given size and returns the context. */
function drawScaled(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  // Better downscaling quality than the default.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      type,
      quality,
    )
  })
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  // Build the binary string one byte at a time rather than spreading each
  // chunk into String.fromCharCode(...). Spreading a 32k-element subarray
  // pushes 32k arguments onto the call stack, which throws "Maximum call
  // stack size exceeded" on some engines/WebViews for a ~1 MB image — the
  // exact size a full-res phone photo produces. A plain loop has no such
  // ceiling and the per-byte cost is negligible for a <=1 MB payload.
  const chunk = 0x2000
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = Math.min(i + chunk, bytes.length)
    for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j])
  }
  return btoa(binary)
}

export interface CompressOptions {
  /** Max long-edge in px before compression starts. Default MAX_EDGE. */
  maxEdge?: number
  /** Target ceiling in bytes. Default TARGET_MAX_BYTES (1 MB). */
  maxBytes?: number
  /** Output mime. Default 'image/jpeg'. Use 'image/png' to keep alpha. */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

export interface CompressedImage {
  blob: Blob
  mimeType: string
  width: number
  height: number
}

/**
 * Compresses a raster image to at or under `maxBytes` while keeping quality
 * as high as the budget allows.
 *
 * Strategy, cheapest-degradation-first:
 *  1. Scale the long edge down to `maxEdge` (free win: most upload bloat is
 *     resolution nobody looks at).
 *  2. Step the encoder quality down from 0.85 toward 0.5 until it fits.
 *  3. If still too big at low quality (large flat images, or PNG which does
 *     not take a quality arg), shrink the dimensions by 15% and retry.
 *
 * JPEG/WebP honour the quality arg; PNG ignores it, so PNG relies on steps 1
 * and 3. Prefer JPEG/WebP for photos and reserve PNG for images that must keep
 * transparency.
 */
export async function compressImage(
  file: Blob,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const maxEdge = options.maxEdge ?? MAX_EDGE
  const maxBytes = options.maxBytes ?? TARGET_MAX_BYTES
  const mimeType = options.mimeType ?? 'image/jpeg'

  const img = await loadImage(file)

  const initialScale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  let width = Math.max(1, Math.round(img.width * initialScale))
  let height = Math.max(1, Math.round(img.height * initialScale))

  const qualitySteps = [0.85, 0.75, 0.65, 0.55, 0.5]
  // Bound the dimension-shrink loop so a pathological input can't spin.
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = drawScaled(img, width, height)

    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, mimeType, quality)
      if (blob.size <= maxBytes) {
        return { blob, mimeType, width, height }
      }
      // PNG ignores quality, so iterating it is pointless — break to shrink.
      if (mimeType === 'image/png') break
    }

    // Everything at these dimensions overshot; shrink and try again.
    width = Math.max(1, Math.round(width * 0.85))
    height = Math.max(1, Math.round(height * 0.85))
  }

  // Last resort: return the smallest we produced at the floor quality/size.
  const canvas = drawScaled(img, width, height)
  const blob = await canvasToBlob(
    canvas,
    mimeType,
    mimeType === 'image/png' ? 1 : qualitySteps[qualitySteps.length - 1],
  )
  return { blob, mimeType, width, height }
}

export async function prepareCapture(file: File): Promise<PreparedImage> {
  // Captures are photos: JPEG, downscaled to the long edge, and squeezed under
  // the 1 MB ceiling that verifyCaptureSchema enforces on the base64 (~1.4 MB
  // of base64 ≈ 1 MB of JPEG).
  const { blob, width, height } = await compressImage(file, {
    maxEdge: MAX_EDGE,
    maxBytes: TARGET_MAX_BYTES,
    mimeType: 'image/jpeg',
  })

  const base64 = await blobToBase64(blob)
  const previewUrl = URL.createObjectURL(blob)

  return { base64, mimeType: 'image/jpeg', previewUrl, width, height }
}


/**
 * Client-side image downscaling, done before anything is uploaded.
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
const QUALITY = 0.8

function loadImage(file: File): Promise<HTMLImageElement> {
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

export async function prepareCapture(file: File): Promise<PreparedImage> {
  const img = await loadImage(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  return { base64, mimeType: 'image/jpeg', previewUrl: dataUrl, width, height }
}

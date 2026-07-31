// ---------------------------------------------------------------------------
// Image uploads — Cloudinary when configured, base64 fallback otherwise.
// ---------------------------------------------------------------------------

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export const cloudinaryEnabled = Boolean(cloudName && uploadPreset)

export function cloudinaryInfo() {
  return { cloudName, uploadPreset }
}

/**
 * Upload a local File and resolve to a URL.
 * Uses Cloudinary's unsigned upload API (returns a secure CDN URL).
 * Falls back to a base64 data-URL when Cloudinary is not configured.
 */
export async function uploadImage(file) {
  if (!file) throw new Error('No file selected')
  if (cloudinaryEnabled) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', uploadPreset)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: fd
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Image upload failed (${res.status}) ${text}`)
    }
    const data = await res.json()
    return data.secure_url || data.url
  }
  // Fallback: read locally into a data URL
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}

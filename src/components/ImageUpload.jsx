import { useRef, useState } from 'react'
import { uploadImage } from '../services/images.js'
import { Btn } from './ui.jsx'

export default function ImageUpload({ value, onChange, alt = 'image' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="image-upload">
      {value ? (
        <div className="image-upload-preview">
          <img src={value} alt={alt} />
          <div className="image-upload-actions">
            <Btn tone="ghost" onClick={() => ref.current?.click()} disabled={uploading}>
              Replace
            </Btn>
            <Btn tone="danger-ghost" onClick={() => onChange('')}>
              Remove
            </Btn>
          </div>
        </div>
      ) : (
        <Btn tone="ghost" onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Upload Image'}
        </Btn>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={onFile} />
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

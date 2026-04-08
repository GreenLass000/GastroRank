import { useEffect, useState } from 'react'
import {
  IMAGE_INPUT_ACCEPT,
  isImagePreviewable,
  normalizeImageUrl,
  readImageFile,
} from '../../lib/images.js'

const MODE_OPTIONS = {
  file: '📷 Subir foto',
  url: '🔗 URL externa',
}

export function ImageInput({
  error = '',
  fileName = '',
  label = 'Foto',
  mode = 'url',
  onChange,
  onModeChange,
  value = '',
}) {
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localFileName, setLocalFileName] = useState(fileName)

  useEffect(() => {
    setLocalFileName(fileName)
  }, [fileName])

  const previewUrl = normalizeImageUrl(value)
  const visibleError = error || localError

  function handleModeSelection(nextMode) {
    setLocalError('')
    onModeChange?.(nextMode)
  }

  function handleUrlChange(event) {
    setLocalError('')
    onChange?.({
      fileName: '',
      value: event.target.value,
    })
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setIsReadingFile(true)
      setLocalError('')
      const nextImage = await readImageFile(file)
      setLocalFileName(nextImage.fileName)
      onChange?.(nextImage)
    } catch (readError) {
      setLocalError(
        readError instanceof Error
          ? readError.message
          : 'No se pudo procesar la imagen.',
      )
    } finally {
      setIsReadingFile(false)
      event.target.value = ''
    }
  }

  return (
    <div className="image-input">
      <div className="image-input__header">
        <span>{label}</span>
        <div className="pill-row">
          {Object.entries(MODE_OPTIONS).map(([optionValue, optionLabel]) => (
            <button
              key={optionValue}
              className={`pill-button${mode === optionValue ? ' chip chip--active' : ''}`}
              type="button"
              onClick={() => handleModeSelection(optionValue)}
            >
              {optionLabel}
            </button>
          ))}
        </div>
      </div>

      {mode === 'file' ? (
        <label className="field">
          <span>Selecciona un archivo</span>
          <input
            type="file"
            accept={IMAGE_INPUT_ACCEPT}
            onChange={handleFileChange}
          />
          <p className="image-input__meta">
            Formatos: jpg, jpeg, png, webp, heic. Tamaño máximo: 25MB. Si supera 1MB, se comprime antes de guardar.
          </p>
          {localFileName ? (
            <p className="image-input__meta">Archivo preparado: {localFileName}</p>
          ) : null}
        </label>
      ) : (
        <label className="field">
          <span>Pega una URL de imagen</span>
          <input
            type="url"
            value={value}
            onChange={handleUrlChange}
            placeholder="https://..."
          />
          <p className="image-input__meta">
            Usa una URL directa y pública si quieres mostrarla en rankings y mapas.
          </p>
        </label>
      )}

      {isReadingFile ? <div className="screen-note">Cargando... Preparando imagen.</div> : null}

      {isImagePreviewable(previewUrl) ? (
        <div className="image-input__preview">
          <strong>Vista previa</strong>
          <img src={previewUrl} alt={label} />
        </div>
      ) : (
        <div className="image-input__preview image-input__preview--empty">
          <strong>Sin imagen seleccionada</strong>
          <p>Elige un archivo o pega una URL para ver la vista previa.</p>
        </div>
      )}

      {visibleError ? (
        <div className="status-banner status-banner--error">
          <strong>Revisión</strong>
          <p>Error al guardar ❌ — {visibleError}</p>
        </div>
      ) : null}
    </div>
  )
}

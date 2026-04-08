import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { normalizeImageUrl } from '../../lib/images.js'
import { validateUserPayload } from '../../lib/validation.js'
import { ImageInput } from './ImageInput.jsx'

const INITIAL_PROFILE_FORM = {
  nombre: '',
  avatarMode: 'url',
  avatarUrlValue: '',
  avatarFileValue: '',
  avatarFileName: '',
}

function buildInitialState(initialValues) {
  const avatarValue = initialValues.avatar_url || ''
  const avatarMode = avatarValue.startsWith('data:image/') ? 'file' : 'url'

  return {
    ...INITIAL_PROFILE_FORM,
    nombre: initialValues.nombre || '',
    avatarMode,
    avatarUrlValue: avatarMode === 'url' ? avatarValue : '',
    avatarFileValue: avatarMode === 'file' ? avatarValue : '',
    avatarFileName: '',
  }
}

export function ProfileForm({ initialValues, onCancel, onSaved }) {
  const { updateUser } = useAppState()
  const [form, setForm] = useState(() => buildInitialState(initialValues))
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setForm(buildInitialState(initialValues))
  }, [initialValues])

  const currentAvatarValue =
    form.avatarMode === 'file' ? form.avatarFileValue : form.avatarUrlValue

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    try {
      const payload = validateUserPayload({
        nombre: form.nombre,
        avatar_url: normalizeImageUrl(currentAvatarValue),
      })

      setIsSubmitting(true)
      const response = await updateUser(initialValues.id, payload)
      onSaved?.(response.user)
      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo guardar el perfil.'}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Nombre</span>
        <input
          type="text"
          value={form.nombre}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              nombre: event.target.value,
            }))
          }
        />
      </label>

      <ImageInput
        label="Avatar"
        mode={form.avatarMode}
        value={currentAvatarValue}
        fileName={form.avatarFileName}
        onModeChange={(nextMode) =>
          setForm((current) => ({
            ...current,
            avatarMode: nextMode,
          }))
        }
        onChange={({ fileName, value }) => {
          if (form.avatarMode === 'file') {
            setForm((current) => ({
              ...current,
              avatarFileName: fileName,
              avatarFileValue: value,
            }))
            return
          }

          setForm((current) => ({
            ...current,
            avatarUrlValue: value,
          }))
        }}
      />

      {status.message ? (
        <div className={`status-banner status-banner--${status.tone || 'info'}`}>
          <strong>{status.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="pill-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>
    </form>
  )
}

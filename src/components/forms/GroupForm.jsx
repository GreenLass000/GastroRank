import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { validateGroupPayload } from '../../lib/validation.js'

const INITIAL_GROUP_FORM = {
  nombre: '',
  tipo: 'amigos',
  visibility: 'privado',
  join_policy: 'código',
}

function buildInitialState(initialValues) {
  return {
    ...INITIAL_GROUP_FORM,
    ...initialValues,
  }
}

export function GroupForm({
  initialValues = INITIAL_GROUP_FORM,
  mode = 'create',
  onCancel,
  onSaved,
}) {
  const { createGroup, currentUser, updateGroup } = useAppState()
  const [form, setForm] = useState(() => buildInitialState(initialValues))
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setForm(buildInitialState(initialValues))
  }, [initialValues])

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    try {
      const payload = validateGroupPayload({
        ...form,
        created_by_user_id: currentUser.id,
      })

      setIsSubmitting(true)

      if (mode === 'edit' && initialValues.id) {
        const response = await updateGroup(initialValues.id, payload)
        onSaved?.(response.group)
      } else {
        const response = await createGroup({
          ...payload,
          created_by_user_id: currentUser.id,
        })
        setForm(INITIAL_GROUP_FORM)
        onSaved?.(response.group)
      }

      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo guardar el grupo.'}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Nombre del grupo</span>
        <input
          type="text"
          value={form.nombre}
          onChange={(event) => updateField('nombre', event.target.value)}
          placeholder="Ej. Ruta croquetera"
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Tipo</span>
          <select
            value={form.tipo}
            onChange={(event) => updateField('tipo', event.target.value)}
          >
            <option value="pareja">Pareja</option>
            <option value="amigos">Amigos</option>
            <option value="familia">Familia</option>
            <option value="otros">Otros</option>
          </select>
        </label>

        <label className="field">
          <span>Visibilidad</span>
          <select
            value={form.visibility}
            onChange={(event) => updateField('visibility', event.target.value)}
          >
            <option value="privado">Privado</option>
            <option value="público">Público</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Política de acceso</span>
        <select
          value={form.join_policy}
          onChange={(event) => updateField('join_policy', event.target.value)}
        >
          <option value="código">Código</option>
          <option value="aprobación">Aprobación</option>
          <option value="abierto">Abierto</option>
        </select>
      </label>

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
          {isSubmitting
            ? 'Guardando...'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Guardar grupo'}
        </button>
      </div>
    </form>
  )
}

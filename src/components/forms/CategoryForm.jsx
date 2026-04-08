import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { validateCategoryPayload } from '../../lib/validation.js'

const INITIAL_CATEGORY_FORM = {
  nombre: '',
  icono: '🍽️',
}

function buildInitialState(initialValues) {
  return {
    ...INITIAL_CATEGORY_FORM,
    ...initialValues,
  }
}

export function CategoryForm({
  initialValues = INITIAL_CATEGORY_FORM,
  mode = 'edit',
  onCancel,
  onSaved,
}) {
  const { categories, createCategory, currentUser, updateCategory } = useAppState()
  const [form, setForm] = useState(() => buildInitialState(initialValues))
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setForm(buildInitialState(initialValues))
  }, [initialValues])

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    try {
      const payload = validateCategoryPayload(
        {
          ...form,
          scope: initialValues.scope || 'usuario',
          created_by_user_id: currentUser.id,
        },
        categories,
        { excludeId: initialValues.id || '' },
      )

      setIsSubmitting(true)

      if (mode === 'edit' && initialValues.id) {
        const response = await updateCategory(initialValues.id, payload)
        onSaved?.(response.category)
      } else {
        const response = await createCategory(payload)
        setForm(INITIAL_CATEGORY_FORM)
        onSaved?.(response.category)
      }

      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo guardar la categoría.'}`,
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

      <label className="field">
        <span>Icono</span>
        <input
          type="text"
          value={form.icono}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              icono: event.target.value,
            }))
          }
        />
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
          {isSubmitting ? 'Guardando...' : 'Guardar categoría'}
        </button>
      </div>
    </form>
  )
}

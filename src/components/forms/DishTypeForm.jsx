import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { validateDishTypePayload } from '../../lib/validation.js'

const INITIAL_DISH_TYPE_FORM = {
  categoria_id: '',
  nombre: '',
  alias: '',
}

function buildInitialState(initialValues) {
  return {
    ...INITIAL_DISH_TYPE_FORM,
    ...initialValues,
  }
}

export function DishTypeForm({
  initialValues = INITIAL_DISH_TYPE_FORM,
  mode = 'edit',
  onCancel,
  onSaved,
}) {
  const {
    categories,
    createDishType,
    currentUser,
    dishTypes,
    updateDishType,
  } = useAppState()
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
      const payload = validateDishTypePayload(
        {
          ...form,
          scope: initialValues.scope || 'usuario',
          created_by_user_id: currentUser.id,
        },
        dishTypes,
        { excludeId: initialValues.id || '' },
      )

      setIsSubmitting(true)

      if (mode === 'edit' && initialValues.id) {
        const response = await updateDishType(initialValues.id, payload)
        onSaved?.(response.dishType)
      } else {
        const response = await createDishType(payload)
        setForm(INITIAL_DISH_TYPE_FORM)
        onSaved?.(response.dishType)
      }

      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo guardar el tipo de plato.'}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Categoría</span>
        <select
          value={form.categoria_id}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              categoria_id: event.target.value,
            }))
          }
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icono} {category.nombre}
            </option>
          ))}
        </select>
      </label>

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
        <span>Alias</span>
        <input
          type="text"
          value={form.alias}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              alias: event.target.value,
            }))
          }
          placeholder="Opcional"
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
          {isSubmitting ? 'Guardando...' : 'Guardar tipo'}
        </button>
      </div>
    </form>
  )
}

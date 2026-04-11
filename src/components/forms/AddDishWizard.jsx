import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { formatScore } from '../../lib/format.js'
import { normalizeImageUrl } from '../../lib/images.js'
import { calculateGeneralScore, getScoreTone } from '../../lib/scoring.js'
import {
  normalizeEntityName,
  validateCategoryPayload,
  validateDishEntryPayload,
  validateDishTypePayload,
} from '../../lib/validation.js'
import { ImageInput } from './ImageInput.jsx'
import { ScoreInput } from './ScoreInput.jsx'

const RESTAURANT_PAGE_SIZE = 5

const STEPS = [
  'Nombre y categoría',
  'Puntuación',
  'Restaurante',
  'Detalles',
]

const INITIAL_FORM = {
  restaurant_id: '',
  categoria_id: '',
  tipo_plato_id: '',
  nombre_plato: '',
  sabor: 0,
  textura: 0,
  presentacion: 0,
  calidad_precio: 0,
  notas: '',
  precio_plato: '',
  fecha: new Date().toISOString().slice(0, 10),
  visibility: 'private',
  photoMode: 'url',
  photoUrlValue: '',
  photoFileValue: '',
  photoFileName: '',
}

const SCORE_FIELDS = [
  { key: 'sabor', label: 'Sabor' },
  { key: 'textura', label: 'Textura' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'calidad_precio', label: 'Calidad / precio' },
]

const STEP_PEEK_HINTS = {
  Puntuación: 'Valora sabor, textura, presentación y calidad-precio.',
  Restaurante: 'Elige un sitio cercano o crea uno nuevo.',
  Detalles: 'Añade notas, fecha, visibilidad y foto.',
}

function buildInitialForm(entryToEdit) {
  if (!entryToEdit) {
    return { ...INITIAL_FORM }
  }

  const photoValue = entryToEdit.foto_url || ''
  const photoMode = photoValue.startsWith('data:image/') ? 'file' : 'url'

  return {
    ...INITIAL_FORM,
    restaurant_id: entryToEdit.restaurant_id || '',
    categoria_id: entryToEdit.categoria_id || '',
    tipo_plato_id: entryToEdit.tipo_plato_id || '',
    nombre_plato: entryToEdit.nombre_plato || '',
    sabor: typeof entryToEdit.sabor === 'number' ? entryToEdit.sabor : 0,
    textura: typeof entryToEdit.textura === 'number' ? entryToEdit.textura : 0,
    presentacion:
      typeof entryToEdit.presentacion === 'number' ? entryToEdit.presentacion : 0,
    calidad_precio:
      typeof entryToEdit.calidad_precio === 'number'
        ? entryToEdit.calidad_precio
        : 0,
    notas: entryToEdit.notas || '',
    precio_plato:
      entryToEdit.precio_plato === null || entryToEdit.precio_plato === undefined
        ? ''
        : String(entryToEdit.precio_plato),
    fecha: entryToEdit.fecha || INITIAL_FORM.fecha,
    visibility: entryToEdit.visibility || 'private',
    photoMode,
    photoUrlValue: photoMode === 'url' ? photoValue : '',
    photoFileValue: photoMode === 'file' ? photoValue : '',
    photoFileName: '',
  }
}

export function AddDishWizard({
  entryToEdit = null,
  mode = 'create',
  onClose,
  onOpenRestaurantForm,
  onSaved,
}) {
  const {
    categories,
    createCategory,
    createDishEntry,
    createDishType,
    currentGroup,
    currentUser,
    dishEntries,
    dishTypes,
    homeNearbySection,
    updateDishEntry,
  } = useAppState()
  const [activeStep, setActiveStep] = useState(mode === 'edit' ? STEPS.length - 1 : 0)
  const [form, setForm] = useState(() => buildInitialForm(entryToEdit))
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [restaurantQuery, setRestaurantQuery] = useState('')
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(
    RESTAURANT_PAGE_SIZE,
  )
  const [showCategoryCreator, setShowCategoryCreator] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState({ nombre: '', icono: '🍽️' })
  const [dishTypeDraft, setDishTypeDraft] = useState({ nombre: '', alias: '' })

  useEffect(() => {
    setForm(buildInitialForm(entryToEdit))
    setActiveStep(mode === 'edit' ? STEPS.length - 1 : 0)

    if (!entryToEdit?.tipo_plato_id) {
      setDishTypeDraft({ nombre: '', alias: '' })
    }
  }, [entryToEdit, mode])

  useEffect(() => {
    if (!entryToEdit?.tipo_plato_id) {
      return
    }

    const dishTypeToEdit =
      dishTypes.find((dishType) => dishType.id === entryToEdit.tipo_plato_id) ?? null

    if (!dishTypeToEdit) {
      return
    }

    setDishTypeDraft({
      nombre: dishTypeToEdit.nombre || '',
      alias: dishTypeToEdit.alias || '',
    })
  }, [dishTypes, entryToEdit?.tipo_plato_id])

  const filteredRestaurants = useMemo(() => {
    const nearbyRestaurants = homeNearbySection?.restaurants ?? []

    if (!restaurantQuery.trim()) {
      return nearbyRestaurants
    }

    const query = normalizeEntityName(restaurantQuery)
    return nearbyRestaurants.filter((restaurant) =>
      normalizeEntityName(
        `${restaurant.nombre} ${restaurant.direccion_texto} ${restaurant.nombre_normalizado}`,
      ).includes(query),
    )
  }, [homeNearbySection?.restaurants, restaurantQuery])

  const visibleRestaurants = useMemo(
    () => filteredRestaurants.slice(0, visibleRestaurantCount),
    [filteredRestaurants, visibleRestaurantCount],
  )

  const hasMoreRestaurants = visibleRestaurants.length < filteredRestaurants.length

  const availableDishTypes = useMemo(
    () =>
      dishTypes.filter((dishType) => dishType.categoria_id === form.categoria_id),
    [dishTypes, form.categoria_id],
  )

  const matchedDishType = useMemo(() => {
    if (!form.categoria_id || !dishTypeDraft.nombre.trim()) {
      return null
    }

    const normalizedDraftName = normalizeEntityName(dishTypeDraft.nombre)
    return (
      availableDishTypes.find(
        (dishType) => normalizeEntityName(dishType.nombre) === normalizedDraftName,
      ) ?? null
    )
  }, [availableDishTypes, dishTypeDraft.nombre, form.categoria_id])

  const liveScore = useMemo(
    () =>
      calculateGeneralScore({
        sabor: form.sabor,
        textura: form.textura,
        presentacion: form.presentacion,
        calidad_precio: form.calidad_precio,
      }) ?? 0,
    [form.calidad_precio, form.presentacion, form.sabor, form.textura],
  )

  const hasAnyScore = useMemo(
    () =>
      SCORE_FIELDS.some((field) => {
        const numericValue = Number(form[field.key])
        return Number.isFinite(numericValue) && numericValue > 0
      }),
    [form],
  )

  const currentPhotoValue = form.photoFileValue || form.photoUrlValue
  const nextStep = STEPS[activeStep + 1] ?? ''

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function selectRestaurant(restaurantId) {
    updateField('restaurant_id', restaurantId)
    setStatus({ tone: '', message: '' })
  }

  function selectCategory(categoryId) {
    setForm((current) => ({
      ...current,
      categoria_id: categoryId,
      tipo_plato_id:
        current.categoria_id === categoryId ? current.tipo_plato_id : '',
    }))
  }

  function selectDishType(dishType) {
    setDishTypeDraft({
      nombre: dishType.nombre || '',
      alias: dishType.alias || '',
    })
    updateField('tipo_plato_id', dishType.id)
    setStatus({ tone: '', message: '' })
  }

  useEffect(() => {
    setVisibleRestaurantCount(RESTAURANT_PAGE_SIZE)
  }, [restaurantQuery, filteredRestaurants.length])

  function canResolveDishTypeStep() {
    if (!form.categoria_id || !dishTypeDraft.nombre.trim()) {
      return false
    }

    if (matchedDishType) {
      return true
    }

    try {
      validateDishTypePayload(
        {
          categoria_id: form.categoria_id,
          nombre: dishTypeDraft.nombre,
          alias: dishTypeDraft.alias,
          scope: 'usuario',
          created_by_user_id: currentUser.id,
        },
        dishTypes,
      )
      return true
    } catch {
      return false
    }
  }

  function validateStep(stepIndex) {
    if (stepIndex === 0) {
      if (!form.categoria_id) {
        return 'Selecciona una categoría para continuar.'
      }

      if (!dishTypeDraft.nombre.trim()) {
        return 'Escribe qué plato vas a puntuar para continuar.'
      }

      if (!canResolveDishTypeStep()) {
        return 'Revisa el nombre del plato para poder reutilizarlo o crearlo antes de avanzar.'
      }
    }

    if (stepIndex === 1) {
      if (!hasAnyScore) {
        return 'Mueve al menos un control de puntuación para continuar.'
      }
    }

    if (stepIndex === 2) {
      if (!form.restaurant_id) {
        return 'Selecciona un restaurante o crea uno nuevo.'
      }
    }

    return ''
  }

  function isNextButtonDisabled() {
    if (activeStep === 1) {
      return !hasAnyScore
    }

    return false
  }

  async function resolveDishTypeStep() {
    if (matchedDishType) {
      if (form.tipo_plato_id !== matchedDishType.id) {
        updateField('tipo_plato_id', matchedDishType.id)
      }

      return matchedDishType.id
    }

    const payload = validateDishTypePayload(
      {
        categoria_id: form.categoria_id,
        nombre: dishTypeDraft.nombre,
        alias: dishTypeDraft.alias,
        scope: 'usuario',
        created_by_user_id: currentUser.id,
      },
      dishTypes,
    )
    const response = await createDishType(payload)

    setDishTypeDraft({
      nombre: response.dishType.nombre || payload.nombre,
      alias: response.dishType.alias || payload.alias || '',
    })
    updateField('tipo_plato_id', response.dishType.id)
    return response.dishType.id
  }

  async function goNext() {
    const error = validateStep(activeStep)
    if (error) {
      setStatus({ tone: 'error', message: `Error al guardar ❌ — ${error}` })
      return
    }

    try {
      if (activeStep === 0) {
        await resolveDishTypeStep()
      }

      setStatus({ tone: '', message: '' })
      setActiveStep((current) => Math.min(current + 1, STEPS.length - 1))
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo preparar el plato.'}`,
      })
    }
  }

  function goBack() {
    setStatus({ tone: '', message: '' })
    setActiveStep((current) => Math.max(current - 1, 0))
  }

  async function handleCreateCategory() {
    try {
      const payload = validateCategoryPayload(
        {
          nombre: categoryDraft.nombre,
          icono: categoryDraft.icono || '🍽️',
          scope: 'usuario',
          created_by_user_id: currentUser.id,
        },
        categories,
      )
      const response = await createCategory(payload)
      selectCategory(response.category.id)
      setCategoryDraft({ nombre: '', icono: '🍽️' })
      setShowCategoryCreator(false)
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo crear la categoría.'}`,
      })
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault?.()
    setStatus({ tone: '', message: '' })

    if (activeStep < STEPS.length - 1) {
      goNext()
      return
    }

    try {
      const payload = validateDishEntryPayload(
        {
          restaurant_id: form.restaurant_id,
          categoria_id: form.categoria_id,
          tipo_plato_id: form.tipo_plato_id,
          nombre_plato: form.nombre_plato,
          sabor: form.sabor,
          textura: form.textura,
          presentacion: form.presentacion,
          calidad_precio: form.calidad_precio,
          precio_plato: form.precio_plato,
          notas: form.notas,
          fecha: form.fecha,
          foto_url: normalizeImageUrl(currentPhotoValue) || null,
          created_by_user_id: currentUser.id,
          group_id: form.visibility === 'group' ? currentGroup?.id ?? null : null,
          visibility: form.visibility,
        },
        dishEntries,
        { excludeId: entryToEdit?.id || '' },
      )

      setIsSubmitting(true)

      if (mode === 'edit' && entryToEdit?.id) {
        const response = await updateDishEntry(entryToEdit.id, payload)
        onSaved?.(response.dishEntry)
      } else {
        const response = await createDishEntry(payload)
        onSaved?.(response.dishEntry)
      }

      onClose?.()
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo guardar el plato.'}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="form-stack">
      <div className="wizard-progress">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`wizard-progress__step${index === activeStep ? ' wizard-progress__step--active' : ''}${index < activeStep ? ' wizard-progress__step--done' : ''}`}
          >
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>

      {activeStep === 0 ? (
        <>
          <div className="dish-step-one">
            <label className="field">
              <span>¿Qué plato vas a puntuar?</span>
              <input
                type="text"
                value={dishTypeDraft.nombre}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDishTypeDraft((current) => ({
                    ...current,
                    nombre: nextValue,
                  }))
                  updateField('tipo_plato_id', '')
                }}
                placeholder="Ej. Croquetas, ramen, tortilla..."
              />
            </label>

            <label className="field dish-step-one__alias">
              <span>¿Cómo lo llamarías tú? 😄</span>
              <input
                type="text"
                value={dishTypeDraft.alias}
                onChange={(event) =>
                  setDishTypeDraft((current) => ({
                    ...current,
                    alias: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="section-header">
            <h2>Categoría</h2>
          </div>

          <div className="category-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`category-card${form.categoria_id === category.id ? ' category-card--active' : ''}`}
                type="button"
                onClick={() => selectCategory(category.id)}
              >
                <span aria-hidden="true">{category.icono}</span>
                <strong>{category.nombre}</strong>
              </button>
            ))}
            <button
              className="category-card category-card--create"
              type="button"
              onClick={() => setShowCategoryCreator((value) => !value)}
            >
              <span aria-hidden="true">＋</span>
              <strong>Nueva categoría</strong>
            </button>
          </div>

          {showCategoryCreator ? (
            <div className="inline-creator">
              <div className="field-grid">
                <label className="field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={categoryDraft.nombre}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
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
                    value={categoryDraft.icono}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
                        ...current,
                        icono: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={handleCreateCategory}
              >
                Guardar categoría
              </button>
            </div>
          ) : null}

          <div className="section-header">
            <h2>Platos ya creados en esta categoría</h2>
          </div>

          {form.categoria_id ? (
            <>
              {availableDishTypes.length > 0 ? (
                <div className="list-stack dish-type-suggestions">
                  {availableDishTypes.map((dishType) => (
                    <button
                      key={dishType.id}
                      className={`selection-card${form.tipo_plato_id === dishType.id || matchedDishType?.id === dishType.id ? ' selection-card--active' : ''}`}
                      type="button"
                      onClick={() => selectDishType(dishType)}
                    >
                      <strong>{dishType.nombre}</strong>
                      <p>{dishType.alias || 'Sin alias'}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="filter-empty">
                  Aún no hay platos guardados en esta categoría. Si sigues, se creará
                  uno nuevo con este nombre.
                </p>
              )}

              {dishTypeDraft.nombre.trim() ? (
                <p className="dish-step-one__helper">
                  {matchedDishType
                    ? `Usaremos el tipo existente "${matchedDishType.nombre}".`
                    : 'No existe coincidencia exacta todavía. Al seguir, se creará este tipo de plato.'}
                </p>
              ) : null}
            </>
          ) : (
            <p className="filter-empty">
              Elige primero una categoría para ver los platos ya creados.
            </p>
          )}
        </>
      ) : null}

      {activeStep === 1 ? (
        <>
          <div className="list-stack score-step">
            {SCORE_FIELDS.map((field) => (
              <ScoreInput
                key={field.key}
                label={field.label}
                name={field.key}
                value={form[field.key]}
                onChange={updateField}
              />
            ))}
          </div>

          <div className="score-summary">
            <strong>Puntuación general</strong>
            <span className={`ranking-card__score ranking-card__score--${getScoreTone(liveScore)}`}>
              {formatScore(liveScore)}
            </span>
          </div>

          {!hasAnyScore ? (
            <p className="score-step__hint">
              Mueve al menos un slider para desbloquear el siguiente paso.
            </p>
          ) : null}
        </>
      ) : null}

      {activeStep === 2 ? (
        <>
          <label className="field">
            <span>Buscar restaurante existente</span>
            <input
              type="text"
              value={restaurantQuery}
              onChange={(event) => setRestaurantQuery(event.target.value)}
              placeholder="Busca por nombre o dirección"
            />
          </label>

          <div className="section-header">
            <h2>
              Cercanos a {homeNearbySection?.originLabel?.toLowerCase() || 'tu ubicación'}
            </h2>
          </div>

          {visibleRestaurants.length > 0 ? (
            <div className="list-stack">
              {visibleRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  className={`selection-card restaurant-selection-card${form.restaurant_id === restaurant.id ? ' selection-card--active' : ''}`}
                  type="button"
                  onClick={() => selectRestaurant(restaurant.id)}
                >
                  <div className="restaurant-selection-card__header">
                    <strong>{restaurant.nombre}</strong>
                    <span className="status-pill">{restaurant.distanceLabel}</span>
                  </div>
                  <p>{restaurant.direccion_texto}</p>
                  <div className="restaurant-selection-card__meta">
                    <span className="status-pill">{restaurant.precio_rango}</span>
                    {(restaurant.tags ?? []).slice(0, 2).map((tag) => (
                      <span key={`${restaurant.id}-${tag}`} className="status-pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="filter-empty">
              No hay restaurantes cercanos que coincidan con esa búsqueda.
            </p>
          )}

          {hasMoreRestaurants ? (
            <button
              className="pill-button"
              type="button"
              onClick={() =>
                setVisibleRestaurantCount(
                  (current) => current + RESTAURANT_PAGE_SIZE,
                )
              }
            >
              Mostrar más
            </button>
          ) : null}

          <button
            className="pill-button restaurant-create-button"
            type="button"
            onClick={onOpenRestaurantForm}
          >
            ＋ Crear nuevo restaurante
          </button>
        </>
      ) : null}

      {activeStep === 3 ? (
        <>
          <label className="field">
            <span>Notas</span>
            <textarea
              rows="4"
              value={form.notas}
              onChange={(event) => updateField('notas', event.target.value)}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Precio</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.precio_plato}
                onChange={(event) => updateField('precio_plato', event.target.value)}
                placeholder="4.50"
              />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                value={form.fecha}
                onChange={(event) => updateField('fecha', event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Visibilidad</span>
            <select
              value={form.visibility}
              onChange={(event) => updateField('visibility', event.target.value)}
            >
              <option value="private">Mi ranking</option>
              <option value="group">Mi grupo</option>
              <option value="public">Comunidad</option>
            </select>
          </label>

          <ImageInput
            label="Foto del plato"
            inputVariant="capture-actions"
            mode="file"
            value={currentPhotoValue}
            fileName={form.photoFileName}
            onChange={({ fileName, value }) => {
              setForm((current) => ({
                ...current,
                photoMode: 'file',
                photoFileName: fileName,
                photoFileValue: value,
                photoUrlValue: '',
              }))
            }}
          />
        </>
      ) : null}

      {nextStep ? (
        <div className="wizard-next-peek" aria-hidden="true">
          <span className="wizard-next-peek__label">Siguiente paso</span>
          <strong className="wizard-next-peek__title">{nextStep}</strong>
          <p>{STEP_PEEK_HINTS[nextStep] || 'Continúa con el siguiente bloque del formulario.'}</p>
        </div>
      ) : null}

      {status.message ? (
        <div className={`status-banner status-banner--${status.tone || 'info'}`}>
          <strong>{status.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="modal-actions">
        <button
          className="pill-button"
          type="button"
          onClick={activeStep === 0 ? onClose : goBack}
        >
          {activeStep === 0 ? 'Cerrar' : 'Atrás'}
        </button>
        {activeStep < STEPS.length - 1 ? (
          <button
            className="primary-button"
            type="button"
            onClick={goNext}
            disabled={isNextButtonDisabled()}
          >
            Siguiente
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Guardando...'
              : mode === 'edit'
                ? 'Guardar cambios'
                : 'Guardar plato'}
          </button>
        )}
      </div>
    </div>
  )
}

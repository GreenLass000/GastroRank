import { useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { formatScore } from '../../lib/format.js'
import { calculateGeneralScore, getScoreTone } from '../../lib/scoring.js'
import { RestaurantForm } from './RestaurantForm.jsx'
import { ScoreInput } from './ScoreInput.jsx'

const STEPS = [
  'Restaurante',
  'Categoría',
  'Tipo de plato',
  'Puntuación',
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
  foto_url: '',
  photoFileName: '',
}

const SCORE_FIELDS = [
  { key: 'sabor', label: 'Sabor' },
  { key: 'textura', label: 'Textura' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'calidad_precio', label: 'Calidad / precio' },
]

function normalizeText(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'))
    reader.readAsDataURL(file)
  })
}

export function AddDishWizard({ onClose, onOpenRestaurantForm }) {
  const {
    categories,
    createCategory,
    createDishEntry,
    createDishType,
    currentGroup,
    currentUser,
    dishEntries,
    dishTypes,
    restaurants,
  } = useAppState()
  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [restaurantQuery, setRestaurantQuery] = useState('')
  const [showInlineRestaurantForm, setShowInlineRestaurantForm] = useState(false)
  const [showCategoryCreator, setShowCategoryCreator] = useState(false)
  const [showDishTypeCreator, setShowDishTypeCreator] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState({ nombre: '', icono: '🍽️' })
  const [dishTypeDraft, setDishTypeDraft] = useState({ nombre: '', alias: '' })

  const filteredRestaurants = useMemo(() => {
    if (!restaurantQuery.trim()) {
      return restaurants
    }

    const query = normalizeText(restaurantQuery)
    return restaurants.filter((restaurant) =>
      `${restaurant.nombre} ${restaurant.direccion_texto} ${restaurant.nombre_normalizado}`
        .toLowerCase()
        .includes(query),
    )
  }, [restaurantQuery, restaurants])

  const availableDishTypes = useMemo(
    () =>
      dishTypes.filter((dishType) => dishType.categoria_id === form.categoria_id),
    [dishTypes, form.categoria_id],
  )

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

  const recentRestaurants = [...restaurants]
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 3)

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function selectRestaurant(restaurantId) {
    updateField('restaurant_id', restaurantId)
    setShowInlineRestaurantForm(false)
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

  function validateStep(stepIndex) {
    if (stepIndex === 0 && !form.restaurant_id) {
      return 'Selecciona un restaurante o crea uno nuevo.'
    }

    if (stepIndex === 1 && !form.categoria_id) {
      return 'Selecciona una categoría para continuar.'
    }

    if (stepIndex === 2 && !form.tipo_plato_id) {
      return 'Selecciona un tipo de plato o créalo al vuelo.'
    }

    return ''
  }

  function goNext() {
    const error = validateStep(activeStep)
    if (error) {
      setStatus({ tone: 'error', message: `Error al guardar ❌ — ${error}` })
      return
    }

    setStatus({ tone: '', message: '' })
    setActiveStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function goBack() {
    setStatus({ tone: '', message: '' })
    setActiveStep((current) => Math.max(current - 1, 0))
  }

  async function handleCreateCategory() {
    if (!categoryDraft.nombre.trim()) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — La categoría necesita un nombre.',
      })
      return
    }

    try {
      const response = await createCategory({
        nombre: categoryDraft.nombre,
        icono: categoryDraft.icono || '🍽️',
        scope: 'usuario',
        created_by_user_id: currentUser.id,
      })
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

  async function handleCreateDishType() {
    if (!form.categoria_id) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — Primero selecciona una categoría.',
      })
      return
    }

    if (!dishTypeDraft.nombre.trim()) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — El tipo de plato necesita un nombre.',
      })
      return
    }

    try {
      const response = await createDishType({
        categoria_id: form.categoria_id,
        nombre: dishTypeDraft.nombre,
        alias: dishTypeDraft.alias,
        scope: 'usuario',
        created_by_user_id: currentUser.id,
      })
      updateField('tipo_plato_id', response.dishType.id)
      setDishTypeDraft({ nombre: '', alias: '' })
      setShowDishTypeCreator(false)
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo crear el tipo de plato.'}`,
      })
    }
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!validTypes.includes(file.type)) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — Formato no permitido. Usa jpg, png, webp o heic.',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — La imagen supera el límite de 5MB.',
      })
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setForm((current) => ({
        ...current,
        foto_url: dataUrl,
        photoFileName: file.name,
      }))
      setStatus({ tone: 'success', message: 'Foto preparada ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo procesar la imagen.'}`,
      })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    const duplicateEntry = dishEntries.find(
      (entry) =>
        entry.created_by_user_id === currentUser.id &&
        entry.restaurant_id === form.restaurant_id &&
        entry.tipo_plato_id === form.tipo_plato_id &&
        entry.fecha === form.fecha,
    )

    if (duplicateEntry) {
      setStatus({
        tone: 'error',
        message:
          'Error al guardar ❌ — Ya existe una valoración tuya para ese plato en ese restaurante y fecha.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await createDishEntry({
        restaurant_id: form.restaurant_id,
        categoria_id: form.categoria_id,
        tipo_plato_id: form.tipo_plato_id,
        nombre_plato: form.nombre_plato,
        sabor: form.sabor,
        textura: form.textura,
        presentacion: form.presentacion,
        calidad_precio: form.calidad_precio,
        precio_plato: form.precio_plato === '' ? null : Number(form.precio_plato),
        notas: form.notas,
        fecha: form.fecha,
        foto_url: form.foto_url || null,
        created_by_user_id: currentUser.id,
        group_id: form.visibility === 'group' ? currentGroup.id : null,
        visibility: form.visibility,
      })
      onClose()
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
    <form className="form-stack" onSubmit={handleSubmit}>
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
            <h2>Restaurantes recientes</h2>
            <button type="button" onClick={() => setShowInlineRestaurantForm((value) => !value)}>
              + Crear nuevo
            </button>
          </div>

          <div className="list-stack">
            {recentRestaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                className={`selection-card${form.restaurant_id === restaurant.id ? ' selection-card--active' : ''}`}
                type="button"
                onClick={() => selectRestaurant(restaurant.id)}
              >
                <strong>{restaurant.nombre}</strong>
                <p>
                  {restaurant.direccion_texto} • {restaurant.precio_rango}
                </p>
              </button>
            ))}
          </div>

          <div className="section-header">
            <h2>Resultados</h2>
            <button type="button" onClick={onOpenRestaurantForm}>
              Abrir formulario completo
            </button>
          </div>

          <div className="list-stack">
            {filteredRestaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                className={`selection-card${form.restaurant_id === restaurant.id ? ' selection-card--active' : ''}`}
                type="button"
                onClick={() => selectRestaurant(restaurant.id)}
              >
                <strong>{restaurant.nombre}</strong>
                <p>
                  {restaurant.direccion_texto} • {restaurant.precio_rango} •{' '}
                  {(restaurant.tags ?? []).slice(0, 3).join(', ')}
                </p>
              </button>
            ))}
          </div>

          {showInlineRestaurantForm ? (
            <div className="inline-creator">
              <RestaurantForm
                onClose={() => setShowInlineRestaurantForm(false)}
                onCreated={(restaurant) => {
                  selectRestaurant(restaurant.id)
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {activeStep === 1 ? (
        <>
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
          </div>

          <button
            className="pill-button"
            type="button"
            onClick={() => setShowCategoryCreator((value) => !value)}
          >
            + Crear categoría
          </button>

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
              <button className="primary-button" type="button" onClick={handleCreateCategory}>
                Guardar categoría
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activeStep === 2 ? (
        <>
          <div className="list-stack">
            {availableDishTypes.map((dishType) => (
              <button
                key={dishType.id}
                className={`selection-card${form.tipo_plato_id === dishType.id ? ' selection-card--active' : ''}`}
                type="button"
                onClick={() => updateField('tipo_plato_id', dishType.id)}
              >
                <strong>{dishType.nombre}</strong>
                <p>{dishType.alias || 'Sin alias'}</p>
              </button>
            ))}
          </div>

          <button
            className="pill-button"
            type="button"
            onClick={() => setShowDishTypeCreator((value) => !value)}
          >
            + Crear tipo de plato
          </button>

          {showDishTypeCreator ? (
            <div className="inline-creator">
              <label className="field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={dishTypeDraft.nombre}
                  onChange={(event) =>
                    setDishTypeDraft((current) => ({
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
                  value={dishTypeDraft.alias}
                  onChange={(event) =>
                    setDishTypeDraft((current) => ({
                      ...current,
                      alias: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button" type="button" onClick={handleCreateDishType}>
                Guardar tipo de plato
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activeStep === 3 ? (
        <>
          <div className="list-stack">
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
        </>
      ) : null}

      {activeStep === 4 ? (
        <>
          <label className="field">
            <span>Nombre libre del plato</span>
            <input
              type="text"
              value={form.nombre_plato}
              onChange={(event) => updateField('nombre_plato', event.target.value)}
              placeholder="Ej. Croqueta cremosa del día"
            />
          </label>

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

          <div className="pill-row">
            <button
              className={`pill-button${form.photoMode === 'file' ? ' chip chip--active' : ''}`}
              type="button"
              onClick={() => updateField('photoMode', 'file')}
            >
              📷 Subir foto
            </button>
            <button
              className={`pill-button${form.photoMode === 'url' ? ' chip chip--active' : ''}`}
              type="button"
              onClick={() => updateField('photoMode', 'url')}
            >
              🔗 URL externa
            </button>
          </div>

          {form.photoMode === 'file' ? (
            <label className="field">
              <span>Foto</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.heic,image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileSelected}
              />
              {form.photoFileName ? <p>{form.photoFileName}</p> : null}
            </label>
          ) : (
            <label className="field">
              <span>URL de foto</span>
              <input
                type="url"
                value={form.foto_url}
                onChange={(event) => updateField('foto_url', event.target.value)}
                placeholder="https://..."
              />
            </label>
          )}
        </>
      ) : null}

      {status.message ? (
        <div className={`status-banner status-banner--${status.tone || 'info'}`}>
          <strong>{status.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="pill-button" type="button" onClick={activeStep === 0 ? onClose : goBack}>
          {activeStep === 0 ? 'Cerrar' : 'Atrás'}
        </button>
        {activeStep < STEPS.length - 1 ? (
          <button className="primary-button" type="button" onClick={goNext}>
            Siguiente
          </button>
        ) : (
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar plato'}
          </button>
        )}
      </div>
    </form>
  )
}

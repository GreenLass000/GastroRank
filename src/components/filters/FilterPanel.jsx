import { useEffect, useMemo, useState } from 'react'
import { normalizeFilters } from '../../lib/filters.js'

function toggleArrayValue(values, nextValue) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue]
}

export function FilterPanel({
  availableOptions,
  filterOriginLabel,
  initialFilters,
  onApply,
  onClose,
  onReset,
}) {
  const [draftFilters, setDraftFilters] = useState(() => initialFilters)

  useEffect(() => {
    setDraftFilters(initialFilters)
  }, [initialFilters])

  const availableDishTypes = useMemo(() => {
    if (!draftFilters.categoryIds.length) {
      return availableOptions.dishTypes
    }

    return availableOptions.dishTypes.filter((dishType) =>
      draftFilters.categoryIds.includes(dishType.categoria_id),
    )
  }, [availableOptions.dishTypes, draftFilters.categoryIds])

  function updateFilters(nextPartial) {
    setDraftFilters((current) =>
      normalizeFilters(
        {
          ...current,
          ...nextPartial,
        },
        availableOptions.dishTypes,
      ),
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    onApply(normalizeFilters(draftFilters, availableOptions.dishTypes))
    onClose?.()
  }

  return (
    <form className="filter-panel" onSubmit={handleSubmit}>
      <div className="status-banner status-banner--info">
        <strong>Zona de referencia</strong>
        <p>
          El filtro por radio usa {filterOriginLabel}. Si no hay geolocalización,
          se mantiene el fallback de Valladolid.
        </p>
      </div>

      <section className="filter-section">
        <h3>Categoría</h3>
        <div className="filter-chip-grid">
          {availableOptions.categories.map((category) => (
            <button
              key={category.id}
              className={`chip${draftFilters.categoryIds.includes(category.id) ? ' chip--active' : ''}`}
              type="button"
              onClick={() =>
                updateFilters({
                  categoryIds: toggleArrayValue(draftFilters.categoryIds, category.id),
                })
              }
            >
              {category.icono} {category.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h3>Tipo de plato</h3>
        <div className="filter-chip-grid">
          {availableDishTypes.length > 0 ? (
            availableDishTypes.map((dishType) => (
              <button
                key={dishType.id}
                className={`chip${draftFilters.dishTypeIds.includes(dishType.id) ? ' chip--active' : ''}`}
                type="button"
                onClick={() =>
                  updateFilters({
                    dishTypeIds: toggleArrayValue(draftFilters.dishTypeIds, dishType.id),
                  })
                }
              >
                {dishType.nombre}
              </button>
            ))
          ) : (
            <p className="filter-empty">
              Selecciona una categoría para limitar tipos de plato.
            </p>
          )}
        </div>
      </section>

      <section className="filter-section">
        <h3>Año</h3>
        <label className="field">
          <span>Filtrar por año</span>
          <select
            value={draftFilters.year}
            onChange={(event) => updateFilters({ year: event.target.value })}
          >
            <option value="">Todos</option>
            {availableOptions.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="filter-section">
        <h3>Rango de precio</h3>
        <div className="filter-chip-grid">
          {availableOptions.priceRanges.map((priceRange) => (
            <button
              key={priceRange}
              className={`chip${draftFilters.priceRanges.includes(priceRange) ? ' chip--active' : ''}`}
              type="button"
              onClick={() =>
                updateFilters({
                  priceRanges: toggleArrayValue(draftFilters.priceRanges, priceRange),
                })
              }
            >
              {priceRange}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h3>Autor o usuario</h3>
        <div className="filter-chip-grid">
          {availableOptions.users.map((user) => (
            <button
              key={user.id}
              className={`chip${draftFilters.authorIds.includes(user.id) ? ' chip--active' : ''}`}
              type="button"
              onClick={() =>
                updateFilters({
                  authorIds: toggleArrayValue(draftFilters.authorIds, user.id),
                })
              }
            >
              {user.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h3>Zona</h3>
        <label className="field">
          <span>Radio desde tu ubicación o Valladolid</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={draftFilters.radiusKm}
            onChange={(event) => updateFilters({ radiusKm: event.target.value })}
            placeholder="Ejemplo: 5"
          />
        </label>
      </section>

      <section className="filter-section">
        <h3>Puntuación mínima</h3>
        <label className="field">
          <span className="filter-range-label">
            Mínimo actual: {Number(draftFilters.minimumScore).toFixed(1)}
          </span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={draftFilters.minimumScore}
            onChange={(event) =>
              updateFilters({ minimumScore: Number(event.target.value) })
            }
          />
        </label>
      </section>

      <label className="filter-toggle">
        <input
          type="checkbox"
          checked={draftFilters.onlyWithPhoto}
          onChange={(event) =>
            updateFilters({ onlyWithPhoto: event.target.checked })
          }
        />
        <span>Solo con foto</span>
      </label>

      <div className="modal-actions">
        <button
          className="pill-button"
          type="button"
          onClick={() => {
            onReset()
            onClose?.()
          }}
        >
          Resetear
        </button>
        <button className="primary-button" type="submit">
          Aplicar filtros
        </button>
      </div>
    </form>
  )
}

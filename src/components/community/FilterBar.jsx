function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export function FilterBar({
  categories,
  dishTypes,
  filters,
  onChange,
  onReset,
}) {
  const availableDishTypes =
    filters.categoryIds.length > 0
      ? dishTypes.filter((dishType) => filters.categoryIds.includes(dishType.categoria_id))
      : dishTypes

  const activeFilterLabels = [
    ...filters.categoryIds
      .map((id) => categories.find((category) => category.id === id))
      .filter(Boolean)
      .map((category) => `${category.icono} ${category.nombre}`),
    ...filters.dishTypeIds
      .map((id) => dishTypes.find((dishType) => dishType.id === id))
      .filter(Boolean)
      .map((dishType) => dishType.nombre),
    ...filters.priceRange,
    filters.minScore ? `Desde ${filters.minScore}` : '',
    filters.datePreset ? `Fecha: ${filters.datePreset}` : '',
  ].filter(Boolean)

  return (
    <section className="community-filter-bar">
      <div className="community-filter-bar__group">
        <strong>Categoría</strong>
        <div className="chip-row">
          {categories.map((category) => (
            <button
              key={category.id}
              className={`chip${filters.categoryIds.includes(category.id) ? ' chip--active' : ''}`}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  categoryIds: toggleValue(filters.categoryIds, category.id),
                })
              }
            >
              {category.icono} {category.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="community-filter-bar__group">
        <strong>Tipo de plato</strong>
        <div className="chip-row">
          {availableDishTypes.map((dishType) => (
            <button
              key={dishType.id}
              className={`chip${filters.dishTypeIds.includes(dishType.id) ? ' chip--active' : ''}`}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  dishTypeIds: toggleValue(filters.dishTypeIds, dishType.id),
                })
              }
            >
              {dishType.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="community-filter-bar__controls">
        <label className="field">
          <span>Precio</span>
          <select
            value={filters.priceRange[0] ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                priceRange: event.target.value ? [event.target.value] : [],
              })
            }
          >
            <option value="">Todos</option>
            <option value="€">€</option>
            <option value="€€">€€</option>
            <option value="€€€">€€€</option>
          </select>
        </label>

        <label className="field">
          <span>Puntuación mínima</span>
          <select
            value={filters.minScore ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                minScore: event.target.value ? Number(event.target.value) : null,
              })
            }
          >
            <option value="">Todas</option>
            <option value="6">6+</option>
            <option value="7">7+</option>
            <option value="8">8+</option>
            <option value="9">9+</option>
          </select>
        </label>

        <label className="field">
          <span>Fecha</span>
          <select
            value={filters.datePreset}
            onChange={(event) =>
              onChange({
                ...filters,
                datePreset: event.target.value,
              })
            }
          >
            <option value="">Todas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
        </label>
      </div>

      {activeFilterLabels.length > 0 ? (
        <div className="community-filter-bar__active">
          {activeFilterLabels.map((label) => (
            <span key={label} className="chip chip--active">
              {label}
            </span>
          ))}
          <button className="pill-button" type="button" onClick={onReset}>
            Resetear
          </button>
        </div>
      ) : null}
    </section>
  )
}

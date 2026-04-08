import { useState } from 'react'
import { FilterPanel } from '../components/filters/FilterPanel.jsx'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatDate, formatScore } from '../lib/format.js'

function escapeCsvValue(value) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  return `"${stringValue.replaceAll('"', '""')}"`
}

function buildListsCsv({ entries, restaurants }) {
  const header = [
    'tipo_registro',
    'nombre',
    'restaurante',
    'direccion',
    'puntuacion',
    'precio',
    'fecha',
  ]
  const restaurantRows = restaurants.map((restaurant) => [
    'restaurante',
    restaurant.nombre,
    restaurant.nombre,
    restaurant.direccion_texto,
    formatScore(restaurant.restaurant_score),
    restaurant.precio_rango,
    restaurant.created_at ? formatDate(restaurant.created_at) : '',
  ])
  const entryRows = entries.map((entry) => [
    'entrada',
    entry.dishTypeName,
    entry.restaurantName,
    '',
    formatScore(entry.puntuacion_general),
    '',
    formatDate(entry.created_at),
  ])

  return [header, ...restaurantRows, ...entryRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
}

export function ListsScreen({ onOpenEntity }) {
  const {
    activeFilterChips,
    activeFilters,
    applyFilters,
    availableFilterOptions,
    currentGroup,
    dishTypes,
    filterOriginLabel,
    filteredDishEntries,
    filteredLatestEntries,
    filteredRestaurantsByScore,
    filtersCount,
    groupsForCurrentUser,
    hasActiveFilters,
    removeFilter,
    resetFilters,
  } = useAppState()
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState({ tone: '', message: '' })

  const totalResults =
    filteredRestaurantsByScore.length + filteredLatestEntries.length

  function handleExportCsv() {
    try {
      const csv = buildListsCsv({
        entries: filteredDishEntries.map((entry) => ({
          ...entry,
          dishTypeName:
            dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id)?.nombre ??
            'Plato',
          restaurantName:
            filteredRestaurantsByScore.find(
              (restaurant) => restaurant.id === entry.restaurant_id,
            )?.nombre ?? 'Restaurante',
        })),
        restaurants: filteredRestaurantsByScore,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ranking-gastronomico-listas.csv'
      link.click()
      URL.revokeObjectURL(url)
      setExportStatus({ tone: 'success', message: 'Guardado ✅ — CSV exportado.' })
    } catch (error) {
      setExportStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo exportar el CSV.'}`,
      })
    }
  }

  return (
    <section className="screen" aria-label="Pantalla de listas">
      <article className="screen__hero">
        <h2>Listas reutilizables para entidades clave</h2>
        <p>
          Esta sección cruza restaurantes, entradas y grupos con filtros
          persistentes y ahora abre detalle real al tocar cada elemento.
        </p>
      </article>

      <div className="screen-note">{totalResults} resultados encontrados</div>
      <div className="pill-row">
        <button
          className="pill-button"
          type="button"
          onClick={() => setIsFilterPanelOpen(true)}
        >
          {filtersCount > 0 ? `Filtrar (${filtersCount})` : 'Filtrar'}
        </button>
        <button className="pill-button" type="button" onClick={handleExportCsv}>
          Exportar CSV
        </button>
      </div>
      {exportStatus.message ? (
        <div className={`status-banner status-banner--${exportStatus.tone || 'info'}`}>
          <strong>{exportStatus.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{exportStatus.message}</p>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <div className="chip-row" aria-label="Filtros activos">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              className="chip chip--active"
              type="button"
              onClick={() => removeFilter(chip.filterKey, chip.value)}
            >
              {chip.label} ✕
            </button>
          ))}
        </div>
      ) : null}

      <SectionHeader title="Restaurantes" />
      <div className="list-stack">
        {filteredRestaurantsByScore.length > 0 ? (
          filteredRestaurantsByScore.map((item) => (
            <button
              key={item.id}
              className="list-card list-card--button"
              type="button"
              onClick={() => onOpenEntity?.({ type: 'restaurant', id: item.id })}
            >
              <div className="list-card__title">
                <span className="emoji-badge" aria-hidden="true">
                  📍
                </span>
                <div>
                  <strong>{item.nombre}</strong>
                  <p>
                    {item.direccion_texto} • {formatScore(item.restaurant_score)} •{' '}
                    {item.precio_rango}
                  </p>
                </div>
              </div>
            </button>
          ))
        ) : (
          <article className="surface-card">
            <strong>Sin restaurantes en la selección</strong>
            <p>Prueba a resetear filtros o ampliar el radio de zona.</p>
          </article>
        )}
      </div>

      <SectionHeader title="Últimas entradas" />
      <div className="list-stack">
        {filteredLatestEntries.length > 0 ? (
          filteredLatestEntries.map((entry) => (
            <button
              key={entry.id}
              className="list-card list-card--button"
              type="button"
              onClick={() => onOpenEntity?.({ type: 'dishEntry', id: entry.id })}
            >
              <div className="list-card__title">
                <span className="emoji-badge" aria-hidden="true">
                  🍽️
                </span>
                <div>
                  <strong>{entry.dishTypeName}</strong>
                  <p>
                    {entry.restaurantName} • {formatDate(entry.created_at)} •{' '}
                    {formatScore(entry.puntuacion_general)}
                  </p>
                </div>
              </div>
            </button>
          ))
        ) : (
          <article className="surface-card">
            <strong>Sin entradas en la selección</strong>
            <p>Los filtros actuales dejan fuera las últimas valoraciones.</p>
          </article>
        )}
      </div>

      <SectionHeader title="Grupos" />
      <div className="list-stack">
        {groupsForCurrentUser.map((group) => (
          <button
            key={group.id}
            className="list-card list-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
          >
            <div className="list-card__title">
              <span className="emoji-badge" aria-hidden="true">
                👥
              </span>
              <div>
                <strong>{group.nombre}</strong>
                <p>
                  {group.tipo} • código {group.invite_code} •{' '}
                  {group.id === currentGroup?.id ? 'Activo' : 'Disponible'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {isFilterPanelOpen ? (
        <ModalSheet
          title="Filtros de listas"
          onClose={() => setIsFilterPanelOpen(false)}
        >
          <FilterPanel
            availableOptions={availableFilterOptions}
            filterOriginLabel={filterOriginLabel}
            initialFilters={activeFilters}
            onApply={applyFilters}
            onClose={() => setIsFilterPanelOpen(false)}
            onReset={resetFilters}
          />
        </ModalSheet>
      ) : null}
    </section>
  )
}

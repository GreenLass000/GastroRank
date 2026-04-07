import { useState } from 'react'
import { FilterPanel } from '../components/filters/FilterPanel.jsx'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatDate, formatScore } from '../lib/format.js'

export function ListsScreen() {
  const {
    activeFilterChips,
    activeFilters,
    applyFilters,
    availableFilterOptions,
    currentGroup,
    filterOriginLabel,
    filteredLatestEntries,
    filteredRestaurantsByScore,
    filtersCount,
    groupsForCurrentUser,
    hasActiveFilters,
    removeFilter,
    resetFilters,
  } = useAppState()
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  const totalResults =
    filteredRestaurantsByScore.length + filteredLatestEntries.length

  return (
    <section className="screen" aria-label="Pantalla de listas">
      <article className="screen__hero">
        <h2>Listas reutilizables para entidades clave</h2>
        <p>
          Esta sección ya permite cruzar restaurantes y entradas con filtros
          persistentes compartidos con rankings.
        </p>
      </article>

      <div className="screen-note">{totalResults} resultados encontrados</div>

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

      <SectionHeader
        title="Restaurantes"
        actionLabel={filtersCount > 0 ? `Filtrar (${filtersCount})` : 'Filtrar'}
        onAction={() => setIsFilterPanelOpen(true)}
      />
      <div className="list-stack">
        {filteredRestaurantsByScore.length > 0 ? (
          filteredRestaurantsByScore.map((item) => (
            <article key={item.id} className="list-card">
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
            </article>
          ))
        ) : (
          <article className="surface-card">
            <strong>Sin restaurantes en la selección</strong>
            <p>Prueba a resetear filtros o ampliar el radio de zona.</p>
          </article>
        )}
      </div>

      <SectionHeader title="Últimas entradas" actionLabel="Histórico" />
      <div className="list-stack">
        {filteredLatestEntries.length > 0 ? (
          filteredLatestEntries.slice(0, 4).map((entry) => (
            <article key={entry.id} className="list-card">
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
            </article>
          ))
        ) : (
          <article className="surface-card">
            <strong>Sin entradas en la selección</strong>
            <p>Los filtros actuales dejan fuera las últimas valoraciones.</p>
          </article>
        )}
      </div>

      <SectionHeader title="Grupos" actionLabel="Invitar" />
      <div className="list-stack">
        {groupsForCurrentUser.map((group) => (
          <article key={group.id} className="list-card">
            <div className="list-card__title">
              <span className="emoji-badge" aria-hidden="true">
                👥
              </span>
              <div>
                <strong>{group.nombre}</strong>
                <p>
                  {group.tipo} • código {group.invite_code} •{' '}
                  {group.id === currentGroup.id ? 'Activo' : 'Disponible'}
                </p>
              </div>
            </div>
          </article>
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

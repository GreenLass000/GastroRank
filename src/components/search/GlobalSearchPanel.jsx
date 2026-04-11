import { useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { formatDate, formatScore, formatShortAddress } from '../../lib/format.js'
import { normalizeEntityName } from '../../lib/validation.js'

function buildSearchResults(query, appState) {
  const normalizedQuery = normalizeEntityName(query)

  if (!normalizedQuery) {
    return {
      restaurants: [],
      dishTypes: [],
      latestEntries: [],
    }
  }

  return {
    restaurants: appState.restaurants.filter((restaurant) =>
      normalizeEntityName(
        `${restaurant.nombre} ${restaurant.direccion_texto} ${(restaurant.tags ?? []).join(' ')}`,
      ).includes(normalizedQuery),
    ),
    dishTypes: appState.dishTypes.filter((dishType) =>
      normalizeEntityName(
        `${dishType.nombre} ${dishType.alias || ''} ${
          appState.categories.find((category) => category.id === dishType.categoria_id)?.nombre || ''
        }`,
      ).includes(normalizedQuery),
    ),
    latestEntries: appState.dishEntries
      .filter((entry) => {
        const restaurant =
          appState.restaurants.find((item) => item.id === entry.restaurant_id)?.nombre || ''
        const dishType =
          appState.dishTypes.find((item) => item.id === entry.tipo_plato_id)?.nombre || ''

        return normalizeEntityName(
          `${entry.nombre_plato || ''} ${restaurant} ${dishType}`,
        ).includes(normalizedQuery)
      })
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .slice(0, 5),
  }
}

export function GlobalSearchPanel({ onClose, onOpenEntity }) {
  const appState = useAppState()
  const [query, setQuery] = useState('')

  const results = useMemo(
    () => buildSearchResults(query, appState),
    [appState, query],
  )

  return (
    <div className="form-stack">
      <label className="field">
        <span>Buscar restaurantes, tipos o platos</span>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Croqueta, Casa Dani, tortilla..."
        />
      </label>

      {!query.trim() ? (
        <article className="surface-card">
          <strong>Búsqueda rápida</strong>
          <p>Busca restaurantes y tipos de plato desde cualquier pantalla.</p>
        </article>
      ) : null}

      <article className="surface-card">
        <div className="section-header">
          <h2>Restaurantes</h2>
        </div>
        <div className="list-stack">
          {results.restaurants.length > 0 ? (
            results.restaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                className="list-card list-card--button"
                type="button"
                onClick={() => {
                  onOpenEntity?.({ type: 'restaurant', id: restaurant.id })
                  onClose?.()
                }}
              >
                <strong>{restaurant.nombre}</strong>
                <p>
                  {formatShortAddress(restaurant.direccion_texto)} •{' '}
                  {formatScore(restaurant.restaurant_score)}
                </p>
              </button>
            ))
          ) : (
            <p className="screen-note">Sin coincidencias.</p>
          )}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-header">
          <h2>Tipos de plato</h2>
        </div>
        <div className="list-stack">
          {results.dishTypes.length > 0 ? (
            results.dishTypes.map((dishType) => (
              <button
                key={dishType.id}
                className="list-card list-card--button"
                type="button"
                onClick={() => {
                  onOpenEntity?.({ type: 'dishType', id: dishType.id })
                  onClose?.()
                }}
              >
                <strong>{dishType.nombre}</strong>
                <p>
                  {dishType.alias ||
                    appState.categories.find(
                      (category) => category.id === dishType.categoria_id,
                    )?.nombre ||
                    'Sin alias'}
                </p>
              </button>
            ))
          ) : (
            <p className="screen-note">Sin coincidencias.</p>
          )}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-header">
          <h2>Platos recientes</h2>
        </div>
        <div className="list-stack">
          {results.latestEntries.length > 0 ? (
            results.latestEntries.map((entry) => {
              const restaurantName =
                appState.restaurants.find((item) => item.id === entry.restaurant_id)?.nombre ??
                'Restaurante'
              const dishTypeName =
                appState.dishTypes.find((item) => item.id === entry.tipo_plato_id)?.nombre ??
                'Plato'

              return (
                <button
                  key={entry.id}
                  className="list-card list-card--button"
                  type="button"
                  onClick={() => {
                    onOpenEntity?.({ type: 'dishEntry', id: entry.id })
                    onClose?.()
                  }}
                >
                  <strong>{entry.nombre_plato || dishTypeName}</strong>
                  <p>
                    {restaurantName} • {formatDate(entry.fecha)} •{' '}
                    {formatScore(entry.puntuacion_general)}
                  </p>
                </button>
              )
            })
          ) : (
            <p className="screen-note">Sin coincidencias.</p>
          )}
        </div>
      </article>
    </div>
  )
}

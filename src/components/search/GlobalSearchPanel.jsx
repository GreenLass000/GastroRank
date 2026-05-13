import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import { searchUsers as searchUsersRequest } from '../../lib/api.js'
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
  const { followUser, unfollowUser, follows, currentUser, ...appState } = useAppState()
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [userSearchError, setUserSearchError] = useState('')
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState('')

  const results = useMemo(
    () => buildSearchResults(query, { ...appState, currentUser, follows }),
    [appState, currentUser, follows, query],
  )

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      const trimmed = query.trim()

      if (!trimmed) {
        setUserResults([])
        setUserSearchError('')
        setIsUserSearchLoading(false)
        return
      }

      try {
        setIsUserSearchLoading(true)
        const response = await searchUsersRequest(trimmed)

        if (cancelled) {
          return
        }

        setUserResults(response.users ?? [])
        setUserSearchError('')
      } catch (error) {
        if (cancelled) {
          return
        }

        setUserResults([])
        setUserSearchError(
          error instanceof Error ? error.message : 'No se pudieron buscar usuarios.',
        )
      } finally {
        if (!cancelled) {
          setIsUserSearchLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      cancelled = true
    }
  }, [query])

  async function handleToggleFollow(user) {
    try {
      setPendingUserId(user.id)

      if (user.isFollowing) {
        await unfollowUser(user.id)
        setUserResults((current) =>
          current.map((item) =>
            item.id === user.id
              ? { ...item, isFollowing: false, isMutual: false }
              : item,
          ),
        )
        return
      }

      await followUser(user.id)
      setUserResults((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                isFollowing: true,
                isMutual: Boolean(item.followsYou),
              }
            : item,
        ),
      )
    } finally {
      setPendingUserId('')
    }
  }

  return (
    <div className="form-stack">
      <label className="field">
        <span>Buscar restaurantes, tipos, platos o usuarios</span>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Croqueta, Casa Dani, tortilla o usuario..."
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
          <h2>Usuarios</h2>
        </div>
        <div className="list-stack">
          {isUserSearchLoading ? <p className="screen-note">Cargando...</p> : null}
          {!isUserSearchLoading && userResults.length > 0
            ? userResults.map((user) => (
                <article key={user.id} className="list-card">
                  <strong>{user.nombre}</strong>
                  <p>{user.bio || 'Perfil de la comunidad'}</p>
                  <div className="section-header">
                    <span className="screen-note">
                      {user.isMutual
                        ? 'Amistad mutua'
                        : user.isFollowing
                          ? 'Siguiendo'
                          : user.followsYou
                            ? 'Te sigue'
                            : 'Disponible'}
                    </span>
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => handleToggleFollow(user)}
                      disabled={pendingUserId === user.id}
                    >
                      {pendingUserId === user.id
                        ? 'Cargando...'
                        : user.isFollowing
                          ? 'Dejar de seguir'
                          : 'Seguir'}
                    </button>
                  </div>
                </article>
              ))
            : null}
          {!isUserSearchLoading && !userSearchError && query.trim() && userResults.length === 0 ? (
            <p className="screen-note">Sin coincidencias.</p>
          ) : null}
          {!isUserSearchLoading && userSearchError ? (
            <p className="screen-note">{userSearchError}</p>
          ) : null}
        </div>
      </article>

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

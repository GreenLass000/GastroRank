import { EmptyState } from '../components/feedback/EmptyState.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from '../components/map/MapView.jsx'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { useAppState } from '../hooks/useAppState.js'
import { filterDishEntries, normalizeFilters } from '../lib/filters.js'
import {
  formatDistance,
  formatScore,
  formatStreetAddress,
} from '../lib/format.js'
import { DEFAULT_PIN_STYLE, PIN_STYLES, STORAGE_KEYS } from '../lib/constants.js'
import {
  buildPlaceSuggestions,
  calculateDistanceMeters,
  DEFAULT_MAP_CENTER,
  fetchPlaceSuggestions,
  generateGoogleMapsDirectionsUrl,
  hasValidCoordinates,
  mergePlaceSuggestions,
} from '../lib/maps.js'
import { calculateAverageScore, getScoreTone } from '../lib/scoring.js'

const PIN_STYLE_OPTIONS = [
  {
    id: 'Nombre',
    label: '🔤 Nombre',
    previewText: 'Bar',
    previewKind: 'text',
  },
  {
    id: 'Categoría',
    label: '🏷 Categoría',
    previewText: '🍽️',
    previewKind: 'emoji',
  },
  {
    id: 'Precio',
    label: '💰 Precio',
    previewText: '€€',
    previewKind: 'text',
  },
  {
    id: 'Puntuación',
    label: '⭐ Puntuación',
    previewText: '8.5',
    previewKind: 'score',
  },
]

function isRestaurantInsideBounds(restaurant, bounds) {
  if (!bounds || !hasValidCoordinates(restaurant)) {
    return false
  }

  return (
    Number(restaurant.lat) <= bounds.north &&
    Number(restaurant.lat) >= bounds.south &&
    Number(restaurant.lng) <= bounds.east &&
    Number(restaurant.lng) >= bounds.west
  )
}

function buildMapRestaurants({
  categories,
  defaultPinStyle,
  entriesByRestaurantId,
  featuredEntryByRestaurantId,
  dishTypes,
  restaurants,
  userPosition,
}) {
  const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]))
  const dishTypesById = Object.fromEntries(dishTypes.map((dishType) => [dishType.id, dishType]))

  return restaurants.map((restaurant) => {
    const restaurantEntries = entriesByRestaurantId[restaurant.id] ?? []
    const bestEntry = featuredEntryByRestaurantId[restaurant.id] ?? null
    const bestDishType = dishTypesById[bestEntry?.tipo_plato_id]
    const bestCategory = categoriesById[bestEntry?.categoria_id]
    const distanceFromUserMeters = calculateDistanceMeters(userPosition, restaurant)
    const averageScore = calculateAverageScore(restaurantEntries)

    return {
      ...restaurant,
      categoryIcon: bestCategory?.icono || '🍽️',
      bestDishName:
        bestEntry?.nombre_plato ||
        bestDishType?.nombre ||
        'Sin platos valorados todavía',
      directionsUrl: generateGoogleMapsDirectionsUrl(restaurant),
      distanceFromUserMeters,
      distanceFromUserLabel: formatDistance(distanceFromUserMeters),
      pinStyle: PIN_STYLES.includes(defaultPinStyle) ? defaultPinStyle : DEFAULT_PIN_STYLE,
      restaurant_score: averageScore,
      score: averageScore,
      total_entries: restaurantEntries.length,
    }
  })
}

function buildSheetPreviewItems(visibleRestaurants, otherRestaurants) {
  return [...visibleRestaurants, ...otherRestaurants].slice(0, 2)
}

export function MapScreen({ onCreateRestaurantAtLocation, onOpenEntity }) {
  const {
    activeFilters,
    categories,
    defaultPinStyle,
    dishEntries,
    dishTypes,
    filterOrigin,
    restaurants,
    setDefaultPinStyle,
  } = useAppState()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [draftLocation, setDraftLocation] = useState(null)
  const [isListExpanded, setIsListExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [searchFeedback, setSearchFeedback] = useState({ tone: '', message: '' })
  const [viewportState, setViewportState] = useState({
    center: hasValidCoordinates(filterOrigin) ? filterOrigin : DEFAULT_MAP_CENTER,
    bounds: null,
    zoom: 14,
  })
  const [viewportRequest, setViewportRequest] = useState({
    center: hasValidCoordinates(filterOrigin) ? filterOrigin : DEFAULT_MAP_CENTER,
    zoom: 14,
    animation: 'set',
    key: 'initial',
  })
  const [hasSeenOnboarding, setHasSeenOnboarding] = usePersistentState(
    STORAGE_KEYS.mapOnboardingSeen,
    false,
  )
  const ignoreViewportInteractionUntilRef = useRef(0)
  const hasViewportInitializedRef = useRef(false)
  const hasUserInteractedRef = useRef(false)
  const listSheetDragStartRef = useRef(null)
  const detailSheetDragStartRef = useRef(null)
  const skipNextSearchEffectRef = useRef(false)

  const userPosition = hasValidCoordinates(filterOrigin) ? filterOrigin : DEFAULT_MAP_CENTER
  const restaurantsById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )
  const filtersWithoutRadius = useMemo(
    () =>
      normalizeFilters(
        {
          ...activeFilters,
          radiusKm: '',
        },
        dishTypes,
      ),
    [activeFilters, dishTypes],
  )
  const filteredEntriesWithoutRadius = useMemo(
    () =>
      filterDishEntries({
        dishTypes,
        entries: dishEntries,
        filters: filtersWithoutRadius,
        filterOrigin,
        restaurantsById,
      }),
    [dishEntries, dishTypes, filterOrigin, filtersWithoutRadius, restaurantsById],
  )
  const filteredRestaurantsWithoutRadius = useMemo(() => {
    const filteredRestaurantIds = new Set(
      filteredEntriesWithoutRadius.map((entry) => entry.restaurant_id),
    )

    return restaurants.filter((restaurant) => filteredRestaurantIds.has(restaurant.id))
  }, [filteredEntriesWithoutRadius, restaurants])
  const entriesByRestaurantId = useMemo(
    () =>
      filteredEntriesWithoutRadius.reduce((acc, entry) => {
        acc[entry.restaurant_id] ??= []
        acc[entry.restaurant_id].push(entry)
        return acc
      }, {}),
    [filteredEntriesWithoutRadius],
  )
  const featuredEntryByRestaurantId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(entriesByRestaurantId).map(([restaurantId, entries]) => [
          restaurantId,
          [...entries].sort(
            (left, right) =>
              (right.puntuacion_general ?? Number.NEGATIVE_INFINITY) -
                (left.puntuacion_general ?? Number.NEGATIVE_INFINITY) ||
              new Date(right.created_at) - new Date(left.created_at),
          )[0] ?? null,
        ]),
      ),
    [entriesByRestaurantId],
  )
  const mapRestaurants = useMemo(
    () =>
      buildMapRestaurants({
        categories,
        defaultPinStyle,
        entriesByRestaurantId,
        featuredEntryByRestaurantId,
        dishTypes,
        restaurants: filteredRestaurantsWithoutRadius.filter((restaurant) =>
          hasValidCoordinates(restaurant),
        ),
        userPosition,
      }),
    [
      categories,
      defaultPinStyle,
      dishTypes,
      entriesByRestaurantId,
      featuredEntryByRestaurantId,
      filteredRestaurantsWithoutRadius,
      userPosition,
    ],
  )
  const activeRadiusMeters = useMemo(() => {
    const radiusKm = Number(activeFilters.radiusKm)
    return Number.isFinite(radiusKm) && radiusKm > 0
      ? radiusKm * 1000
      : Number.POSITIVE_INFINITY
  }, [activeFilters.radiusKm])
  const restaurantsWithinActiveRadius = useMemo(
    () =>
      mapRestaurants.filter(
        (restaurant) =>
          calculateDistanceMeters(viewportState.center, restaurant) <= activeRadiusMeters,
      ),
    [activeRadiusMeters, mapRestaurants, viewportState.center],
  )
  const restaurantsForMap = useMemo(
    () =>
      restaurantsWithinActiveRadius.map((restaurant) => ({
        ...restaurant,
        pinStyle: defaultPinStyle,
      })),
    [defaultPinStyle, restaurantsWithinActiveRadius],
  )
  const visibleRestaurants = useMemo(
    () =>
      restaurantsWithinActiveRadius
        .filter((restaurant) => isRestaurantInsideBounds(restaurant, viewportState.bounds))
        .map((restaurant) => ({
          ...restaurant,
          distanceFromCenterMeters: calculateDistanceMeters(
            viewportState.center,
            restaurant,
          ),
        }))
        .sort(
          (left, right) =>
            left.distanceFromCenterMeters - right.distanceFromCenterMeters ||
            right.restaurant_score - left.restaurant_score,
        ),
    [restaurantsWithinActiveRadius, viewportState.bounds, viewportState.center],
  )
  const otherNearbyRestaurants = useMemo(
    () =>
      restaurantsWithinActiveRadius
        .filter((restaurant) => !isRestaurantInsideBounds(restaurant, viewportState.bounds))
        .map((restaurant) => ({
          ...restaurant,
          distanceFromCenterMeters: calculateDistanceMeters(
            viewportState.center,
            restaurant,
          ),
        }))
        .sort(
          (left, right) =>
            left.distanceFromCenterMeters - right.distanceFromCenterMeters ||
            right.restaurant_score - left.restaurant_score,
        ),
    [restaurantsWithinActiveRadius, viewportState.bounds, viewportState.center],
  )
  const previewRestaurants = useMemo(
    () => buildSheetPreviewItems(visibleRestaurants, otherNearbyRestaurants),
    [otherNearbyRestaurants, visibleRestaurants],
  )
  const selectedRestaurant =
    restaurantsWithinActiveRadius.find((restaurant) => restaurant.id === selectedRestaurantId) ||
    null
  const hasRegisteredRestaurants = useMemo(
    () => restaurants.some((restaurant) => hasValidCoordinates(restaurant)),
    [restaurants],
  )

  useEffect(() => {
    if (hasSeenOnboarding) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setHasSeenOnboarding(true)
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [hasSeenOnboarding, setHasSeenOnboarding])

  useEffect(() => {
    if (!hasValidCoordinates(filterOrigin) || hasUserInteractedRef.current) {
      return
    }

    ignoreViewportInteractionUntilRef.current = Date.now() + 900
    setViewportRequest({
      center: filterOrigin,
      zoom: 14,
      animation: 'set',
      key: `gps:${filterOrigin.lat}:${filterOrigin.lng}`,
    })
  }, [filterOrigin])

  useEffect(() => {
    if (!selectedRestaurantId) {
      return
    }

    const isStillVisible = restaurantsWithinActiveRadius.some(
      (restaurant) => restaurant.id === selectedRestaurantId,
    )

    if (!isStillVisible) {
      setSelectedRestaurantId('')
    }
  }, [restaurantsWithinActiveRadius, selectedRestaurantId])

  useEffect(() => {
    const query = searchQuery.trim()

    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false
      return undefined
    }

    if (query.length < 3) {
      setSearchSuggestions([])
      setSearchFeedback({ tone: '', message: '' })
      return undefined
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setSearchFeedback({ tone: 'info', message: 'Cargando...' })
        const localSuggestions = buildPlaceSuggestions(query, restaurants)
        const remoteSuggestions = await fetchPlaceSuggestions(query, {
          signal: controller.signal,
        })
        const mergedSuggestions = mergePlaceSuggestions(
          localSuggestions,
          remoteSuggestions,
        )

        setSearchSuggestions(mergedSuggestions)
        setSearchFeedback(
          mergedSuggestions.length > 0
            ? { tone: '', message: '' }
            : { tone: 'error', message: 'No se encontraron lugares para esa búsqueda.' },
        )
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        const localSuggestions = buildPlaceSuggestions(query, restaurants)
        setSearchSuggestions(localSuggestions)
        setSearchFeedback({
          tone: 'error',
          message:
            localSuggestions.length > 0
              ? 'No se pudo consultar fuera, pero se muestran coincidencias locales.'
              : `Error al buscar ❌ — ${error instanceof Error ? error.message : 'No se pudo completar la búsqueda.'}`,
        })
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [restaurants, searchQuery])

  function requestViewport(center, zoom = viewportState.zoom, animation = 'fly', key = 'manual') {
    ignoreViewportInteractionUntilRef.current = Date.now() + 900
    setViewportRequest({
      center,
      zoom,
      animation,
      key: `${key}:${Date.now()}`,
    })
  }

  function openRestaurantDetail(restaurantId) {
    if (!restaurantId) {
      return
    }

    onOpenEntity?.({ type: 'restaurant', id: restaurantId })
  }

  function handleViewportChange(nextViewport) {
    setViewportState(nextViewport)

    if (!hasViewportInitializedRef.current) {
      hasViewportInitializedRef.current = true
      return
    }

    if (Date.now() < ignoreViewportInteractionUntilRef.current) {
      return
    }

    hasUserInteractedRef.current = true
  }

  function handleLocationSelection(suggestion) {
    skipNextSearchEffectRef.current = true
    setSearchQuery(
      suggestion.address ? `${suggestion.name} · ${suggestion.address}` : suggestion.name,
    )
    setSearchSuggestions([])
    setSearchFeedback({ tone: '', message: '' })
    setDraftLocation(null)
    setSelectedRestaurantId('')
    hasUserInteractedRef.current = true
    requestViewport(
      {
        lat: Number(suggestion.lat),
        lng: Number(suggestion.lng),
      },
      15,
      'fly',
      `search:${suggestion.id}`,
    )
  }

  function handleListSheetHandlePointerDown(event) {
    listSheetDragStartRef.current = event.clientY
  }

  function handleListSheetHandlePointerUp(event) {
    if (typeof listSheetDragStartRef.current !== 'number') {
      setIsListExpanded((current) => !current)
      return
    }

    const deltaY = event.clientY - listSheetDragStartRef.current
    listSheetDragStartRef.current = null

    if (Math.abs(deltaY) < 10) {
      setIsListExpanded((current) => !current)
      return
    }

    if (deltaY < -24) {
      setIsListExpanded(true)
      return
    }

    if (deltaY > 24) {
      setIsListExpanded(false)
    }
  }

  function handleDetailSheetPointerDown(event) {
    detailSheetDragStartRef.current = event.clientY
  }

  function handleDetailSheetPointerUp(event) {
    if (typeof detailSheetDragStartRef.current !== 'number') {
      return
    }

    const deltaY = event.clientY - detailSheetDragStartRef.current
    detailSheetDragStartRef.current = null

    if (deltaY > 36) {
      setSelectedRestaurantId('')
    }
  }

  return (
    <section className="screen screen--map" aria-label="Pantalla de mapa">
      {!hasRegisteredRestaurants ? (
        <EmptyState
          actionLabel="Añadir restaurante"
          description="No hay restaurantes registrados aún."
          onAction={() => onCreateRestaurantAtLocation?.(userPosition)}
          title="Mapa vacío"
        />
      ) : null}

      <div
        className={`map-stage map-stage--immersive${
          !hasRegisteredRestaurants ? ' map-stage--disabled' : ''
        }`}
      >
        <div className="map-stage__canvas">
          <MapView
            center={viewportRequest.center}
            className="map-screen__map"
            emptyDescription="No hay restaurantes en esta zona con los filtros activos."
            emptyTitle="Sin restaurantes visibles"
            markers={restaurantsForMap}
            onLongPress={(location) => {
              setDraftLocation(location)
              setSelectedRestaurantId('')
            }}
            onPopupAction={openRestaurantDetail}
            onSelectMarker={(restaurantId) => {
              setDraftLocation(null)
              setSelectedRestaurantId(restaurantId)
            }}
            onViewportChange={handleViewportChange}
            pinStyle={defaultPinStyle}
            popupMarkerId={selectedRestaurantId}
            selectedMarkerId={selectedRestaurantId}
            showTopline={false}
            tempMarker={
              draftLocation
                ? {
                    ...draftLocation,
                    nombre: 'Nueva ubicación',
                    categoryIcon: '📍',
                    score: null,
                  }
                : null
            }
            viewportAnimation={viewportRequest.animation}
            viewportKey={viewportRequest.key}
            zoom={viewportRequest.zoom}
          >
            <div className="map-screen__overlay map-screen__overlay--header">
              <div className="field--autocomplete map-search map-search--floating">
                <label className="map-search__field">
                  <span className="sr-only">Buscar zona o lugar</span>
                  <input
                    type="search"
                    value={searchQuery}
                    placeholder="🔍 Buscar zona, barrio o lugar..."
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && searchSuggestions[0]) {
                        event.preventDefault()
                        handleLocationSelection(searchSuggestions[0])
                      }
                    }}
                  />
                </label>
                {searchFeedback.message ? (
                  <p
                    className={`map-search__feedback map-search__feedback--${
                      searchFeedback.tone || 'info'
                    }`}
                  >
                    {searchFeedback.message}
                  </p>
                ) : null}
                {searchSuggestions.length > 0 ? (
                  <div className="suggestion-dropdown map-search__dropdown">
                    {searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        className="suggestion-card"
                        type="button"
                        onClick={() => handleLocationSelection(suggestion)}
                      >
                        <strong>{suggestion.name}</strong>
                        <span>{suggestion.address || 'Ubicación seleccionable'}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="map-search__meta">
                <span className="map-counter-chip">
                  {visibleRestaurants.length} restaurantes en esta zona
                </span>
                <button
                  className="map-floating-button map-floating-button--location-inline"
                  type="button"
                  onClick={() => {
                    hasUserInteractedRef.current = true
                    requestViewport(userPosition, 15, 'fly', 'gps-button')
                  }}
                >
                  📍 Mi ubicación
                </button>
              </div>
            </div>

            <div className="map-screen__overlay map-screen__overlay--filters">
              <div
                className="map-pin-style-selector map-pin-style-selector--floating"
                role="tablist"
                aria-label="Estilo de pins"
              >
                {PIN_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={`map-pin-style-chip${
                      defaultPinStyle === option.id ? ' map-pin-style-chip--active' : ''
                    }`}
                    type="button"
                    role="tab"
                    aria-selected={defaultPinStyle === option.id}
                    onClick={() => setDefaultPinStyle(option.id)}
                  >
                    <span
                      className={`map-pin-style-chip__preview map-pin-style-chip__preview--${option.previewKind} ${
                        option.id === 'Puntuación'
                          ? 'map-pin-style-chip__preview--good'
                          : 'map-pin-style-chip__preview--neutral'
                      }`}
                      aria-hidden="true"
                    >
                      {option.previewText}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!hasSeenOnboarding ? (
              <div className="map-onboarding-tip" role="status">
                <span>💡 Mantén pulsado el mapa para añadir un restaurante</span>
                <button
                  type="button"
                  onClick={() => setHasSeenOnboarding(true)}
                  aria-label="Cerrar ayuda del mapa"
                >
                  ✕
                </button>
              </div>
            ) : null}
          </MapView>

          {draftLocation ? (
            <div className="map-draft-sheet">
              <div>
                <strong>Nuevo restaurante listo</strong>
                <p>La ubicación deliberada ya está fijada en el mapa.</p>
              </div>
              <div className="map-action-banner__actions">
                <button
                  className="pill-button"
                  type="button"
                  onClick={() => setDraftLocation(null)}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onCreateRestaurantAtLocation?.(draftLocation)}
                >
                  Crear restaurante aquí
                </button>
              </div>
            </div>
          ) : null}

          {selectedRestaurant ? (
            <>
              <button
                className="map-sheet-backdrop"
                type="button"
                aria-label="Cerrar ficha del restaurante"
                onClick={() => setSelectedRestaurantId('')}
              />
              <article
                className={`map-detail-sheet${
                  isListExpanded ? ' map-detail-sheet--above-expanded-list' : ''
                }`}
              >
              <button
                className="map-sheet-handle"
                type="button"
                aria-label="Deslizar para cerrar ficha"
                onPointerDown={handleDetailSheetPointerDown}
                onPointerUp={handleDetailSheetPointerUp}
              >
                  <span />
                </button>
                <div className="map-detail-sheet__content">
                  <div className="map-detail-sheet__header">
                    <strong>{selectedRestaurant.nombre}</strong>
                  </div>
                  <div className="map-detail-sheet__meta">
                    <span
                      className={`ranking-card__score ranking-card__score--${getScoreTone(
                        selectedRestaurant.restaurant_score,
                      )}`}
                    >
                      {formatScore(selectedRestaurant.restaurant_score)}
                    </span>
                    <span>{selectedRestaurant.total_entries} platos</span>
                    <span>{selectedRestaurant.categoryIcon}</span>
                  </div>
                  <p>{selectedRestaurant.distanceFromUserLabel}</p>
                  <p>Mejor plato: {selectedRestaurant.bestDishName}</p>
                  <div className="map-detail-sheet__actions">
                    <button
                      className="pill-button"
                      type="button"
                      onClick={() => openRestaurantDetail(selectedRestaurant.id)}
                    >
                      Ver detalle
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        if (selectedRestaurant.directionsUrl) {
                          window.open(
                            selectedRestaurant.directionsUrl,
                            '_blank',
                            'noreferrer',
                          )
                        }
                      }}
                    >
                      🗺 Cómo llegar
                    </button>
                  </div>
                </div>
              </article>
            </>
          ) : null}

          <section
            className={`map-list-sheet${isListExpanded ? ' map-list-sheet--expanded' : ''}`}
            aria-label="Lista de restaurantes del mapa"
          >
            <button
              className="map-sheet-handle map-sheet-handle--list"
              type="button"
              aria-expanded={isListExpanded}
              aria-label={
                isListExpanded
                  ? 'Contraer lista de restaurantes'
                  : 'Expandir lista de restaurantes'
              }
              onPointerDown={handleListSheetHandlePointerDown}
              onPointerUp={handleListSheetHandlePointerUp}
            >
              <span />
            </button>

            {!isListExpanded ? (
              <div className="map-list-sheet__preview">
                {previewRestaurants.length > 0 ? (
                  previewRestaurants.map((restaurant) => (
                    <button
                      key={restaurant.id}
                      className="map-list-card"
                      type="button"
                      onClick={() => {
                        setSelectedRestaurantId(restaurant.id)
                        requestViewport(
                          {
                            lat: Number(restaurant.lat),
                            lng: Number(restaurant.lng),
                          },
                          viewportState.zoom,
                          'fly',
                          `restaurant:${restaurant.id}`,
                        )
                      }}
                    >
                      <div>
                        <strong>{restaurant.nombre}</strong>
                        <p>{formatStreetAddress(restaurant.direccion_texto)}</p>
                      </div>
                      <div className="map-list-card__side">
                        <span
                          className={`ranking-card__score ranking-card__score--${getScoreTone(
                            restaurant.restaurant_score,
                          )}`}
                        >
                          {formatScore(restaurant.restaurant_score)}
                        </span>
                        <span>{formatDistance(restaurant.distanceFromCenterMeters)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <article className="map-list-empty">
                    <strong>Sin restaurantes en esta zona</strong>
                    <p>Ajusta filtros o mueve el mapa para descubrir más opciones.</p>
                  </article>
                )}
              </div>
            ) : (
              <div className="map-list-sheet__content">
                <div className="map-list-section">
                  <div className="map-list-section__header">
                    <strong>Restaurantes que ves en el mapa</strong>
                    <span>{visibleRestaurants.length}</span>
                  </div>
                  {visibleRestaurants.length > 0 ? (
                    visibleRestaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        className="map-list-card"
                        type="button"
                        onClick={() => {
                          setSelectedRestaurantId(restaurant.id)
                          requestViewport(
                            {
                              lat: Number(restaurant.lat),
                              lng: Number(restaurant.lng),
                            },
                            viewportState.zoom,
                            'fly',
                            `restaurant:${restaurant.id}`,
                          )
                        }}
                      >
                        <div>
                          <strong>{restaurant.nombre}</strong>
                          <p>{formatStreetAddress(restaurant.direccion_texto)}</p>
                        </div>
                        <div className="map-list-card__side">
                          <span
                            className={`ranking-card__score ranking-card__score--${getScoreTone(
                              restaurant.restaurant_score,
                            )}`}
                          >
                            {formatScore(restaurant.restaurant_score)}
                          </span>
                          <span>{formatDistance(restaurant.distanceFromCenterMeters)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <article className="map-list-empty">
                      <strong>Ahora mismo no ves restaurantes en el encuadre</strong>
                      <p>Mueve el mapa o amplía el radio activo para traer resultados.</p>
                    </article>
                  )}
                </div>

                <div className="map-list-section">
                  <div className="map-list-section__header">
                    <strong>Otros restaurantes cerca</strong>
                    <span>{otherNearbyRestaurants.length}</span>
                  </div>
                  {otherNearbyRestaurants.length > 0 ? (
                    otherNearbyRestaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        className="map-list-card"
                        type="button"
                        onClick={() => {
                          setSelectedRestaurantId(restaurant.id)
                          requestViewport(
                            {
                              lat: Number(restaurant.lat),
                              lng: Number(restaurant.lng),
                            },
                            viewportState.zoom,
                            'fly',
                            `restaurant:${restaurant.id}`,
                          )
                        }}
                      >
                        <div>
                          <strong>{restaurant.nombre}</strong>
                          <p>{formatStreetAddress(restaurant.direccion_texto)}</p>
                        </div>
                        <div className="map-list-card__side">
                          <span
                            className={`ranking-card__score ranking-card__score--${getScoreTone(
                              restaurant.restaurant_score,
                            )}`}
                          >
                            {formatScore(restaurant.restaurant_score)}
                          </span>
                          <span>{formatDistance(restaurant.distanceFromCenterMeters)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <article className="map-list-empty">
                      <strong>No hay otros restaurantes cercanos</strong>
                      <p>Todo lo disponible con estos filtros ya está dentro del mapa visible.</p>
                    </article>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

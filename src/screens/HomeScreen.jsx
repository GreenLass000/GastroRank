import { useMemo, useState } from 'react'
import { MapView } from '../components/map/MapView.jsx'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import {
  formatDistance,
  formatScore,
  formatStreetAddress,
} from '../lib/format.js'
import {
  DEFAULT_HOME_NEARBY_RADIUS_ID,
  generateGoogleMapsDirectionsUrl,
  getHomeNearbyRadiusOption,
  HOME_NEARBY_RADIUS_OPTIONS,
} from '../lib/maps.js'
import { getScoreTone } from '../lib/scoring.js'

export function HomeScreen({ onNavigate, onOpenEntity, onOpenSearch }) {
  const {
    categories,
    defaultPinStyle,
    homeDishTypeSection,
    homeNearbySection,
    latestEntries,
    restaurantPinStyleOverrides,
  } = useAppState()
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [activeDishTypeId, setActiveDishTypeId] = useState('')
  const [activeNearbyRadiusId, setActiveNearbyRadiusId] = useState(
    DEFAULT_HOME_NEARBY_RADIUS_ID,
  )
  const [selectedNearbyRestaurantId, setSelectedNearbyRestaurantId] = useState('')

  const activeNearbyRadius = getHomeNearbyRadiusOption(activeNearbyRadiusId)
  const activeNearbyRadiusIndex = Math.max(
    0,
    HOME_NEARBY_RADIUS_OPTIONS.findIndex((option) => option.id === activeNearbyRadius.id),
  )
  const activeNearbyRadiusProgress =
    HOME_NEARBY_RADIUS_OPTIONS.length > 1
      ? (activeNearbyRadiusIndex / (HOME_NEARBY_RADIUS_OPTIONS.length - 1)) * 100
      : 0

  const availableDishTypes = activeCategoryId
    ? homeDishTypeSection.dishTypesByCategoryId[activeCategoryId] ?? []
    : homeDishTypeSection.dishTypes
  const visibleRankingEntries = activeDishTypeId
    ? homeDishTypeSection.rankingsByDishTypeId[activeDishTypeId] ?? []
    : activeCategoryId
      ? homeDishTypeSection.rankingsByCategoryId[activeCategoryId] ?? []
      : homeDishTypeSection.rankings
  const visibleNearbyRestaurants = useMemo(
    () =>
      homeNearbySection.restaurants.filter(
        (restaurant) => restaurant.distanceMeters <= activeNearbyRadius.meters,
      ),
    [activeNearbyRadius.meters, homeNearbySection.restaurants],
  )
  const selectedNearbyRestaurant = visibleNearbyRestaurants.find(
    (restaurant) => restaurant.id === selectedNearbyRestaurantId,
  )
  const nearbyMapMarkers = useMemo(
    () =>
      visibleNearbyRestaurants.map((restaurant) => ({
        ...restaurant,
        score: restaurant.restaurant_score ?? 0,
        categoryIcon: '🍽️',
        pinStyle:
          restaurantPinStyleOverrides[restaurant.id] || defaultPinStyle,
      })),
    [
      defaultPinStyle,
      restaurantPinStyleOverrides,
      visibleNearbyRestaurants,
    ],
  )
  const effectiveSelectedNearbyRestaurantId = selectedNearbyRestaurant?.id || ''

  function handleCategoryChange(nextCategoryId) {
    setActiveCategoryId(nextCategoryId)

    if (!nextCategoryId) {
      return
    }

    const nextDishTypes = homeDishTypeSection.dishTypesByCategoryId[nextCategoryId] ?? []
    const dishTypeStillAvailable = nextDishTypes.some(
      (dishType) => dishType.id === activeDishTypeId,
    )

    if (!dishTypeStillAvailable) {
      setActiveDishTypeId('')
    }
  }

  function handleNearbyRestaurantToggle(restaurantId) {
    setSelectedNearbyRestaurantId((currentId) =>
      currentId === restaurantId ? '' : restaurantId,
    )
  }

  function handleNearbyRadiusChange(event) {
    const nextIndex = Number(event.target.value)
    const nextOption = HOME_NEARBY_RADIUS_OPTIONS[nextIndex]

    if (!nextOption) {
      return
    }

    setActiveNearbyRadiusId(nextOption.id)
  }

  return (
    <section className="screen" aria-label="Pantalla de inicio">
      <button
        className="home-search-bar"
        type="button"
        onClick={onOpenSearch}
        aria-label="Buscar restaurante o plato"
      >
        <span aria-hidden="true">🔍</span>
        <span>Buscar restaurante o plato...</span>
      </button>

      <SectionHeader
        title="Últimos platos añadidos"
        actionLabel="Ver todo"
        onAction={() => onNavigate?.('community')}
      />
      <div className="horizontal-scroll">
        {latestEntries.map((dish) => (
          <button
            key={dish.id}
            className="list-card list-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'dishEntry', id: dish.id })}
          >
            <div className="list-card__title">
              <span className="emoji-badge" aria-hidden="true">
                {categories.find((category) => category.id === dish.categoria_id)?.icono}
              </span>
              <div>
                <strong>{dish.dishTypeName}</strong>
                <p>{dish.restaurantName}</p>
              </div>
            </div>
            <div className="list-card__meta">
              <span className="status-pill">{dish.visibility}</span>
              <span
                className={`ranking-card__score ranking-card__score--${getScoreTone(dish.puntuacion_general)}`}
              >
                {formatScore(dish.puntuacion_general)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <SectionHeader
        title="🏆 Top por plato"
        actionLabel="Explorar"
        onAction={() => onNavigate?.('rankings')}
      />
      <div className="chip-row chip-row--categories">
        <button
          className={`chip chip--category${!activeCategoryId ? ' chip--active' : ''}`}
          type="button"
          onClick={() => handleCategoryChange('')}
        >
          Todas
        </button>
        {homeDishTypeSection.categories.map((category) => (
          <button
            key={category.id}
            className={`chip chip--category${category.id === activeCategoryId ? ' chip--active' : ''}`}
            type="button"
            onClick={() => handleCategoryChange(category.id)}
          >
            {category.icon} {category.name}
          </button>
        ))}
      </div>

      <div className="chip-row chip-row--dish-types">
        <button
          className={`chip chip--dish-type${!activeDishTypeId ? ' chip--active' : ''}`}
          type="button"
          onClick={() => setActiveDishTypeId('')}
        >
          Todos
        </button>
        {availableDishTypes.map((dishType) => (
          <button
            key={dishType.id}
            className={`chip chip--dish-type${dishType.id === activeDishTypeId ? ' chip--active' : ''}`}
            type="button"
            onClick={() => setActiveDishTypeId(dishType.id)}
          >
            {dishType.name}
          </button>
        ))}
      </div>

      {visibleRankingEntries.length > 0 ? (
        <div className="list-stack">
          {visibleRankingEntries.slice(0, 5).map((entry, index) => (
            <button
              key={entry.id}
              className="ranking-card ranking-card--button"
              type="button"
              onClick={() =>
                onOpenEntity?.({
                  type: 'restaurant',
                  id: entry.restaurantId,
                })
              }
            >
              <div className="ranking-card__meta">
                <div className="ranking-card__title">
                  <span className="emoji-badge" aria-hidden="true">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🍽️'}
                  </span>
                  <div className="ranking-card__body">
                    <strong>
                      {index + 1}. {entry.dishTypeName}
                    </strong>
                    <p>{entry.votos} votos</p>
                    <p className="ranking-card__secondary">{entry.restaurantName}</p>
                  </div>
                </div>
                <span
                  className={`ranking-card__score ranking-card__score--${getScoreTone(entry.score)}`}
                >
                  {formatScore(entry.score)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <article className="surface-card">
          <strong>Sin datos aún</strong>
          <p>Aquí aparecerá el ranking del plato seleccionado.</p>
        </article>
      )}

      <SectionHeader
        title="Restaurantes cercanos"
        actionLabel="Abrir mapa"
        onAction={() => onNavigate?.('map')}
      />
      <article className="map-card map-card--home-nearby">
        <MapView
          center={homeNearbySection.origin}
          className="home-nearby-map"
          emptyDescription={`No hay restaurantes dentro de ${formatDistance(activeNearbyRadius.meters).toLowerCase()}. Prueba con un radio mayor o abre el mapa completo.`}
          emptyTitle="Sin restaurantes en este radio"
          focusMarker={{
            ...homeNearbySection.origin,
            id: 'home-origin',
            nombre: homeNearbySection.originLabel,
          }}
          markers={nearbyMapMarkers}
          onSelectMarker={setSelectedNearbyRestaurantId}
          pinStyle={defaultPinStyle}
          selectedMarkerId={effectiveSelectedNearbyRestaurantId}
          showTopline={false}
          zoom={activeNearbyRadius.zoom}
        />
      </article>

      <div className="surface-card home-nearby-slider">
        <strong>Radio: {formatDistance(activeNearbyRadius.meters)}</strong>
        <input
          className="home-nearby-slider__input"
          type="range"
          min="0"
          max={String(HOME_NEARBY_RADIUS_OPTIONS.length - 1)}
          step="1"
          value={activeNearbyRadiusIndex}
          onChange={handleNearbyRadiusChange}
          aria-label="Seleccionar radio de restaurantes cercanos"
          style={{
            '--nearby-slider-progress': `${activeNearbyRadiusProgress}%`,
          }}
        />
      </div>

      {visibleNearbyRestaurants.length > 0 ? (
        <div className="list-stack">
          {visibleNearbyRestaurants.map((restaurant) => (
            <div key={restaurant.id} className="home-nearby-item">
              <button
                className={`surface-card surface-card--button home-nearby-card${
                  restaurant.id === effectiveSelectedNearbyRestaurantId
                    ? ' surface-card--selected'
                    : ''
                }`}
                type="button"
                aria-expanded={restaurant.id === effectiveSelectedNearbyRestaurantId}
                onClick={() => handleNearbyRestaurantToggle(restaurant.id)}
              >
                <div className="ranking-card__meta">
                  <div>
                    <strong>{restaurant.nombre}</strong>
                    <p>{formatStreetAddress(restaurant.direccion_texto)}</p>
                  </div>
                  <span
                    className={`ranking-card__score ranking-card__score--${getScoreTone(restaurant.restaurant_score)}`}
                  >
                    {formatScore(restaurant.restaurant_score)}
                  </span>
                </div>
                <div className="detail-grid detail-grid--compact">
                  <span className="status-pill">{restaurant.distanceLabel}</span>
                  <span className="status-pill">{restaurant.precio_rango}</span>
                  <span className="status-pill">
                    {restaurant.total_entries} platos
                  </span>
                </div>
              </button>

              {restaurant.id === effectiveSelectedNearbyRestaurantId ? (
                <article className="surface-card home-nearby-panel">
                  <span className="status-pill home-nearby-panel__distance">
                    📍 {restaurant.distanceLabel}
                  </span>
                  <div className="modal-actions home-nearby-panel__actions">
                    <button
                      className="pill-button"
                      type="button"
                      onClick={() =>
                        onOpenEntity?.({ type: 'restaurant', id: restaurant.id })
                      }
                    >
                      🔵 Ver detalle
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        const mapsUrl = generateGoogleMapsDirectionsUrl(restaurant)

                        if (mapsUrl) {
                          window.open(mapsUrl, '_blank', 'noreferrer')
                        }
                      }}
                    >
                      🗺 Cómo llegar
                    </button>
                  </div>
                </article>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <article className="surface-card">
          <strong>Sin restaurantes cercanos ahora mismo</strong>
          <p>
            Amplía el radio o abre el mapa completo para explorar más zonas desde{' '}
            {homeNearbySection.originLabel.toLowerCase()}.
          </p>
        </article>
      )}
    </section>
  )
}

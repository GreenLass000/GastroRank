import { useMemo, useState } from 'react'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { MapView } from '../components/map/MapView.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatScore } from '../lib/format.js'
import { PIN_STYLES } from '../lib/constants.js'
import { generateGoogleMapsUrl, getMapsProvider } from '../lib/maps.js'

export function MapScreen({
  onCreateRestaurantAtLocation,
  onNavigate,
  onOpenEntity,
}) {
  const {
    categories,
    clearRestaurantPinStyle,
    defaultPinStyle,
    dishEntries,
    dishTypes,
    restaurantPinStyleOverrides,
    restaurantsByScore,
    setDefaultPinStyle,
    setRestaurantPinStyle,
  } = useAppState()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [draftLocation, setDraftLocation] = useState(null)
  const provider = getMapsProvider()

  const restaurants = useMemo(
    () =>
      restaurantsByScore.map((restaurant) => {
        const restaurantEntries = dishEntries.filter(
          (entry) => entry.restaurant_id === restaurant.id,
        )
        const bestEntry = [...restaurantEntries].sort(
          (left, right) => right.puntuacion_general - left.puntuacion_general,
        )[0]
        const bestDishType = dishTypes.find(
          (dishType) => dishType.id === bestEntry?.tipo_plato_id,
        )
        const bestCategory = categories.find(
          (category) => category.id === bestEntry?.categoria_id,
        )

        return {
          ...restaurant,
          score: restaurant.restaurant_score ?? 0,
          pinStyle:
            restaurantPinStyleOverrides[restaurant.id] || defaultPinStyle,
          bestDishName:
            bestEntry?.nombre_plato ||
            bestDishType?.nombre ||
            'Sin platos valorados todavía',
          bestDishScore: bestEntry?.puntuacion_general ?? null,
          categoryIcon: bestCategory?.icono || '🍽️',
          mapsUrl: restaurant.google_maps_url || generateGoogleMapsUrl(restaurant),
        }
      }),
    [
      categories,
      defaultPinStyle,
      dishEntries,
      dishTypes,
      restaurantPinStyleOverrides,
      restaurantsByScore,
    ],
  )

  const effectiveSelectedRestaurantId = draftLocation
    ? ''
    : selectedRestaurantId || restaurants[0]?.id || ''
  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === effectiveSelectedRestaurantId) ||
    null

  return (
    <section className="screen" aria-label="Pantalla de mapa">
      <article className="screen__hero">
        <h2>Mapa interactivo con selección deliberada</h2>
        <p>
          El mapa pinta restaurantes reales, diferencia tap de long-press y abre
          detalle útil desde cada pin.
        </p>
      </article>

      <SectionHeader
        title="Vista del mapa"
        actionLabel={provider === 'leaflet-osm' ? 'OpenStreetMap' : 'Mapa'}
        onAction={() => {
          window.open('https://www.openstreetmap.org', '_blank', 'noreferrer')
        }}
      />
      <article className="map-card">
        <MapView
          allowAutoLocate
          instructionLabel="Toca un pin para ver detalle o mantén pulsado 500 ms para crear restaurante."
          markers={restaurants}
          onLongPress={(location) => {
            setDraftLocation(location)
            setSelectedRestaurantId('')
          }}
          onSelectMarker={setSelectedRestaurantId}
          pinStyle={defaultPinStyle}
          selectedMarkerId={effectiveSelectedRestaurantId}
          tempMarker={
            draftLocation
              ? {
                  ...draftLocation,
                  nombre: 'Nueva ubicación',
                  score: 9,
                  categoryIcon: '📍',
                }
              : null
          }
        />
        {draftLocation ? (
          <div className="map-action-banner">
            <div>
              <strong>Nuevo punto listo ✅</strong>
              <p>
                Lat {draftLocation.lat.toFixed(5)} • Lng {draftLocation.lng.toFixed(5)}
              </p>
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
      </article>

      <SectionHeader title="Estilos de pin" />
      <div className="chip-row">
        {PIN_STYLES.map((style) => (
          <button
            key={style}
            className={`chip${defaultPinStyle === style ? ' chip--active' : ''}`}
            type="button"
            onClick={() => setDefaultPinStyle(style)}
          >
            {style}
          </button>
        ))}
      </div>

      <article className="surface-card">
        <strong>Regla crítica</strong>
        <p>
          Un tap normal nunca debe crear restaurantes. La creación solo se activa
          con long-press de al menos 500 ms.
        </p>
      </article>

      {selectedRestaurant ? (
        <article className="surface-card">
          <strong>{selectedRestaurant.nombre}</strong>
          <p>
            {selectedRestaurant.precio_rango} •{' '}
            {formatScore(selectedRestaurant.restaurant_score)} •{' '}
            {selectedRestaurant.total_entries} platos valorados
          </p>
          <p>
            Mejor plato: {selectedRestaurant.bestDishName}
            {typeof selectedRestaurant.bestDishScore === 'number'
              ? ` (${formatScore(selectedRestaurant.bestDishScore)})`
              : ''}
          </p>
          {selectedRestaurant.direccion_texto ? (
            <p>{selectedRestaurant.direccion_texto}</p>
          ) : null}
          <div className="chip-row">
            {PIN_STYLES.map((style) => (
              <button
                key={style}
                className={`chip${selectedRestaurant.pinStyle === style ? ' chip--active' : ''}`}
                type="button"
                onClick={() => setRestaurantPinStyle(selectedRestaurant.id, style)}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="map-action-banner__actions">
            <button
              className="pill-button"
              type="button"
              onClick={() => clearRestaurantPinStyle(selectedRestaurant.id)}
              disabled={!restaurantPinStyleOverrides[selectedRestaurant.id]}
            >
              Quitar override
            </button>
            <button
              className="pill-button"
              type="button"
              onClick={() =>
                onOpenEntity?.({ type: 'restaurant', id: selectedRestaurant.id })
              }
            >
              Ver detalle
            </button>
          </div>
          {selectedRestaurant.mapsUrl ? (
            <a href={selectedRestaurant.mapsUrl} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
          ) : null}
        </article>
      ) : null}

      <SectionHeader
        title="Pins previstos con datos reales"
        actionLabel="Ver lista"
        onAction={() => onNavigate?.('lists')}
      />
      <div className="list-stack">
        {restaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            className="surface-card surface-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'restaurant', id: restaurant.id })}
          >
            <strong>{restaurant.nombre}</strong>
            <p>
              {restaurant.precio_rango} • {formatScore(restaurant.restaurant_score)} •{' '}
              {restaurant.total_entries} platos valorados
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

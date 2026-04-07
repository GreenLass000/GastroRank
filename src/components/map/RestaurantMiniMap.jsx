import { useMemo } from 'react'
import { hasValidCoordinates } from '../../lib/maps.js'
import { MapView } from './MapView.jsx'

export function RestaurantMiniMap({ lat, lng, onLongPress, restaurants = [] }) {
  const nearbyMarkers = useMemo(
    () =>
      restaurants
        .filter((restaurant) => hasValidCoordinates(restaurant))
        .slice(0, 8)
        .map((restaurant) => ({
          id: restaurant.id,
          nombre: restaurant.nombre,
          lat: Number(restaurant.lat),
          lng: Number(restaurant.lng),
          precio_rango: restaurant.precio_rango,
          score: restaurant.restaurant_score ?? 0,
          categoryIcon: '🍽️',
          cover_photo_url: restaurant.cover_photo_url,
        })),
    [restaurants],
  )

  const tempMarker = hasValidCoordinates({ lat, lng })
    ? {
        id: 'selected-location',
        nombre: 'Ubicación elegida',
        lat: Number(lat),
        lng: Number(lng),
        score: 9,
        categoryIcon: '📍',
      }
    : null

  return (
    <div className="mini-map-card">
      <MapView
        allowAutoLocate={false}
        instructionLabel="Mantén pulsado 500 ms para fijar el pin o corrige la ubicación."
        markers={nearbyMarkers}
        mode="mini"
        onLongPress={onLongPress}
        pinStyle="Punto"
        tempMarker={tempMarker}
      />
    </div>
  )
}

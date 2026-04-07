export const DEFAULT_MAP_CENTER = {
  lat: 41.6523,
  lng: -4.7245,
}

const NOMINATIM_BASE_URL =
  import.meta.env.VITE_NOMINATIM_BASE_URL?.trim() ||
  'https://nominatim.openstreetmap.org'
const DEFAULT_SPAN = {
  lat: 0.05,
  lng: 0.08,
}

const MAP_PADDING = 0.12

function normalizeMapText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function hasGoogleMapsApiKey() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
}

export function getMapsProvider() {
  return 'leaflet-osm'
}

export function hasValidCoordinates(point) {
  if (!point) {
    return false
  }

  const lat = Number(point.lat)
  const lng = Number(point.lng)

  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function generateGoogleMapsUrl(point) {
  if (!hasValidCoordinates(point)) {
    return ''
  }

  return `https://maps.google.com/?q=${Number(point.lat)},${Number(point.lng)}`
}

export function buildPlaceSuggestions(query, restaurants) {
  const normalizedQuery = normalizeMapText(query)

  if (normalizedQuery.length < 3) {
    return []
  }

  return restaurants
    .filter((restaurant) => hasValidCoordinates(restaurant))
    .map((restaurant) => {
      const normalizedName = normalizeMapText(restaurant.nombre)
      const normalizedAddress = normalizeMapText(restaurant.direccion_texto)
      const matchIndex = Math.min(
        normalizedName.includes(normalizedQuery)
          ? normalizedName.indexOf(normalizedQuery)
          : Number.POSITIVE_INFINITY,
        normalizedAddress.includes(normalizedQuery)
          ? normalizedAddress.indexOf(normalizedQuery)
          : Number.POSITIVE_INFINITY,
      )

      return {
        id: restaurant.id,
        name: restaurant.nombre,
        address: restaurant.direccion_texto,
        lat: Number(restaurant.lat),
        lng: Number(restaurant.lng),
        googleMapsUrl:
          restaurant.google_maps_url || generateGoogleMapsUrl(restaurant),
        matchIndex,
      }
    })
    .filter((item) => Number.isFinite(item.matchIndex))
    .sort((left, right) => left.matchIndex - right.matchIndex)
    .slice(0, 5)
}

function buildSuggestionName(result) {
  const address = result.address ?? {}

  return (
    result.name ||
    address.amenity ||
    address.shop ||
    address.tourism ||
    address.leisure ||
    address.building ||
    String(result.display_name ?? '').split(',')[0]?.trim() ||
    'Lugar'
  )
}

export async function fetchPlaceSuggestions(query, { signal } = {}) {
  const normalizedQuery = normalizeMapText(query)

  if (normalizedQuery.length < 3) {
    return []
  }

  const url = new URL('/search', NOMINATIM_BASE_URL)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'es')
  url.searchParams.set('countrycodes', 'es')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()

  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
    .map((item) => ({
      id: `nominatim:${item.place_id}`,
      name: buildSuggestionName(item),
      address: item.display_name ?? '',
      lat: Number(item.lat),
      lng: Number(item.lon),
      googleMapsUrl: generateGoogleMapsUrl({
        lat: Number(item.lat),
        lng: Number(item.lon),
      }),
      source: 'external',
    }))
}

export function mergePlaceSuggestions(primarySuggestions, fallbackSuggestions) {
  const seen = new Set()
  const merged = []

  for (const suggestion of [...primarySuggestions, ...fallbackSuggestions]) {
    const key = [
      normalizeMapText(suggestion.name),
      Number(suggestion.lat).toFixed(5),
      Number(suggestion.lng).toFixed(5),
    ].join(':')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(suggestion)
  }

  return merged.slice(0, 5)
}

export function buildMapBounds(points) {
  const validPoints = points.filter(hasValidCoordinates).map((point) => ({
    lat: Number(point.lat),
    lng: Number(point.lng),
  }))

  if (validPoints.length === 0) {
      return {
      minLat: DEFAULT_MAP_CENTER.lat - DEFAULT_SPAN.lat / 2,
      maxLat: DEFAULT_MAP_CENTER.lat + DEFAULT_SPAN.lat / 2,
      minLng: DEFAULT_MAP_CENTER.lng - DEFAULT_SPAN.lng / 2,
      maxLng: DEFAULT_MAP_CENTER.lng + DEFAULT_SPAN.lng / 2,
    }
  }

  const minLat = Math.min(...validPoints.map((point) => point.lat))
  const maxLat = Math.max(...validPoints.map((point) => point.lat))
  const minLng = Math.min(...validPoints.map((point) => point.lng))
  const maxLng = Math.max(...validPoints.map((point) => point.lng))

  const spanLat = Math.max(maxLat - minLat, DEFAULT_SPAN.lat / 3)
  const spanLng = Math.max(maxLng - minLng, DEFAULT_SPAN.lng / 3)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  return {
    minLat: centerLat - spanLat / 2,
    maxLat: centerLat + spanLat / 2,
    minLng: centerLng - spanLng / 2,
    maxLng: centerLng + spanLng / 2,
  }
}

export function getBoundsCenter(bounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  }
}

export function getBoundsSpan(bounds) {
  return {
    lat: bounds.maxLat - bounds.minLat || DEFAULT_SPAN.lat,
    lng: bounds.maxLng - bounds.minLng || DEFAULT_SPAN.lng,
  }
}

export function buildViewportBounds(bounds, panOffset = { lat: 0, lng: 0 }, zoom = 1) {
  const center = getBoundsCenter(bounds)
  const span = getBoundsSpan(bounds)
  const safeZoom = Math.max(1, zoom)
  const nextLatSpan = span.lat / safeZoom
  const nextLngSpan = span.lng / safeZoom
  const nextCenterLat = center.lat + (panOffset.lat || 0)
  const nextCenterLng = center.lng + (panOffset.lng || 0)

  return {
    minLat: nextCenterLat - nextLatSpan / 2,
    maxLat: nextCenterLat + nextLatSpan / 2,
    minLng: nextCenterLng - nextLngSpan / 2,
    maxLng: nextCenterLng + nextLngSpan / 2,
  }
}

export function projectPointToMap(point, bounds) {
  const lngSpan = bounds.maxLng - bounds.minLng || DEFAULT_SPAN.lng
  const latSpan = bounds.maxLat - bounds.minLat || DEFAULT_SPAN.lat
  const usableWidth = 1 - MAP_PADDING * 2
  const usableHeight = 1 - MAP_PADDING * 2

  return {
    x:
      MAP_PADDING +
      ((Number(point.lng) - bounds.minLng) / lngSpan) * usableWidth,
    y:
      MAP_PADDING +
      (1 - (Number(point.lat) - bounds.minLat) / latSpan) * usableHeight,
  }
}

export function unprojectPointFromMap(point, bounds) {
  const lngSpan = bounds.maxLng - bounds.minLng || DEFAULT_SPAN.lng
  const latSpan = bounds.maxLat - bounds.minLat || DEFAULT_SPAN.lat
  const usableWidth = 1 - MAP_PADDING * 2
  const usableHeight = 1 - MAP_PADDING * 2
  const normalizedX = Math.min(
    1,
    Math.max(0, (point.x - MAP_PADDING) / usableWidth),
  )
  const normalizedY = Math.min(
    1,
    Math.max(0, (point.y - MAP_PADDING) / usableHeight),
  )

  return {
    lat: Number((bounds.maxLat - normalizedY * latSpan).toFixed(6)),
    lng: Number((bounds.minLng + normalizedX * lngSpan).toFixed(6)),
  }
}

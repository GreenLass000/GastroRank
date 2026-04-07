import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import {
  buildPlaceSuggestions,
  fetchPlaceSuggestions,
  generateGoogleMapsUrl,
  getMapsProvider,
  mergePlaceSuggestions,
} from '../../lib/maps.js'
import { RestaurantMiniMap } from '../map/RestaurantMiniMap.jsx'

const LOCATION_REQUIRED_MESSAGE =
  'La ubicación es obligatoria. Búscala con IA, selecciona en el mapa o usa tu ubicación actual.'

const INITIAL_FORM = {
  nombre: '',
  direccion_texto: '',
  precio_rango: '€',
  notas: '',
  cover_photo_url: '',
  google_maps_url: '',
  lat: '',
  lng: '',
  tags: '',
}

export function RestaurantForm({ initialLocation = null, onClose, onCreated }) {
  const { createRestaurant, currentUser, restaurants } = useAppState()
  const [form, setForm] = useState(INITIAL_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [searchStatus, setSearchStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [remotePlaceSuggestions, setRemotePlaceSuggestions] = useState([])
  const mapsProvider = getMapsProvider()

  const locationPreview = useMemo(() => {
    if (form.lat === '' || form.lng === '') {
      return null
    }

    const lat = Number(form.lat)
    const lng = Number(form.lng)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return null
    }

    return {
      latNumber: lat,
      lngNumber: lng,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      mapsUrl: generateGoogleMapsUrl({ lat, lng }),
    }
  }, [form.lat, form.lng])
  const hasLocation = Boolean(locationPreview)
  const localPlaceSuggestions = useMemo(
    () => buildPlaceSuggestions(form.nombre, restaurants),
    [form.nombre, restaurants],
  )
  const placeSuggestions = useMemo(
    () => mergePlaceSuggestions(remotePlaceSuggestions, localPlaceSuggestions),
    [localPlaceSuggestions, remotePlaceSuggestions],
  )
  const showSuggestionDropdown = isSearchFocused && placeSuggestions.length > 0

  function applyLocation(location) {
    setForm((current) => ({
      ...current,
      nombre: location.name || current.nombre,
      direccion_texto: location.address || current.direccion_texto,
      lat: String(location.lat),
      lng: String(location.lng),
      google_maps_url:
        location.googleMapsUrl || generateGoogleMapsUrl(location),
    }))
    setIsSearchFocused(false)
  }

  function updateField(name, value) {
    if (name === 'nombre') {
      setRemotePlaceSuggestions([])
      setIsSearchingPlaces(false)
      setSearchStatus({ tone: '', message: '' })
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  useEffect(() => {
    if (!initialLocation) {
      return
    }

    const lat = Number(initialLocation.lat)
    const lng = Number(initialLocation.lng)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return
    }

    setForm((current) => ({
      ...current,
      lat: String(lat),
      lng: String(lng),
      google_maps_url: generateGoogleMapsUrl({ lat, lng }),
    }))
    setStatus({
      tone: 'success',
      message: 'Ubicación encontrada ✅ — Se ha precargado desde el mapa.',
    })
  }, [initialLocation])

  useEffect(() => {
    const query = form.nombre.trim()

    if (query.length < 3) {
      return undefined
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setIsSearchingPlaces(true)
        setSearchStatus({
          tone: 'info',
          message: 'Cargando... Buscando coincidencias reales en OpenStreetMap.',
        })
        const suggestions = await fetchPlaceSuggestions(query, {
          signal: controller.signal,
        })

        setRemotePlaceSuggestions(suggestions)
        setSearchStatus(
          suggestions.length > 0
            ? {
                tone: 'success',
                message: 'Ubicación encontrada ✅ — Se muestran resultados reales del proveedor abierto.',
              }
            : {
                tone: 'info',
                message:
                  localPlaceSuggestions.length > 0
                    ? 'No hubo resultados externos, pero se mantienen coincidencias locales guardadas.'
                    : 'No se encontraron coincidencias para esa búsqueda.',
              },
        )
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setRemotePlaceSuggestions([])
        setSearchStatus({
          tone: localPlaceSuggestions.length > 0 ? 'info' : 'error',
          message:
            localPlaceSuggestions.length > 0
              ? 'Error al buscar fuera ❌ — Se muestran coincidencias locales guardadas.'
              : `Error al buscar fuera ❌ — ${error instanceof Error ? error.message : 'No se pudo consultar OpenStreetMap.'}`,
        })
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingPlaces(false)
        }
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [form.nombre, localPlaceSuggestions.length])

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — Tu navegador no soporta geolocalización.',
      })
      return
    }

    setIsLocating(true)
    setStatus({ tone: '', message: '' })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsLocating(false)
        setStatus({
          tone: 'success',
          message: 'Ubicación encontrada ✅ — Ubicación actual aplicada.',
        })
      },
      (error) => {
        setIsLocating(false)
        setStatus({
          tone: 'error',
          message: `Error al guardar ❌ — ${error.message}`,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
      },
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    if (!form.nombre.trim()) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — El nombre del restaurante es obligatorio.',
      })
      return
    }

    if (!hasLocation) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${LOCATION_REQUIRED_MESSAGE}`,
      })
      return
    }

    setIsSubmitting(true)

    const payload = {
      ...form,
      lat: locationPreview.latNumber,
      lng: locationPreview.lngNumber,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      created_by_user_id: currentUser.id,
    }

    try {
      const response = await createRestaurant(payload)

      setStatus({
        tone: 'success',
        message: 'Guardado ✅',
      })

      if (response?.restaurant) {
        window.setTimeout(() => {
          onCreated?.(response.restaurant)
          onClose()
        }, 500)
      }
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo crear el restaurante.'}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="field field--autocomplete">
        <span>🔍 Buscar lugar en el mapa</span>
        <input
          type="text"
          value={form.nombre}
          onChange={(event) => updateField('nombre', event.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsSearchFocused(false)
            }, 120)
          }}
          placeholder="Nombre del restaurante"
        />

        {showSuggestionDropdown ? (
          <div
            className="suggestion-dropdown"
            role="listbox"
            aria-label="Sugerencias de restaurantes"
          >
            {placeSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                className="suggestion-card"
                type="button"
                onClick={() => {
                  applyLocation(suggestion)
                  setRemotePlaceSuggestions([])
                  setSearchStatus({ tone: '', message: '' })
                  setStatus({
                    tone: 'success',
                    message: `Ubicación encontrada ✅ — ${suggestion.address || suggestion.name}`,
                  })
                }}
              >
                <strong>{suggestion.name}</strong>
                <span>{suggestion.address || 'Sin dirección guardada'}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {searchStatus.message ? (
        <div className={`status-banner status-banner--${searchStatus.tone || 'info'}`}>
          <strong>Búsqueda de lugares</strong>
          <p>{searchStatus.message}</p>
        </div>
      ) : null}

      <div className="status-banner status-banner--info">
        <strong>
          {mapsProvider === 'leaflet-osm'
            ? 'OpenStreetMap activo'
            : 'Mapa activo'}
        </strong>
        <p>
          {mapsProvider === 'leaflet-osm'
            ? 'El formulario usa Leaflet + OpenStreetMap y consulta búsqueda externa abierta antes de caer al fallback local.'
            : 'El mapa está activo y puedes fijar la ubicación con pulsación larga.'}
        </p>
      </div>

      {isSearchingPlaces ? (
        <div className="screen-note">Cargando... Buscando lugares reales.</div>
      ) : null}

      <label className="field">
        <span>Dirección</span>
        <input
          type="text"
          value={form.direccion_texto}
          onChange={(event) => updateField('direccion_texto', event.target.value)}
          placeholder="Calle, barrio o referencia"
        />
      </label>

      <RestaurantMiniMap
        lat={form.lat}
        lng={form.lng}
        onLongPress={(location) => {
          applyLocation(location)
          setStatus({
            tone: 'success',
            message: 'Ubicación encontrada ✅ — Pin fijado con pulsación larga.',
          })
        }}
        restaurants={restaurants}
      />

      <div className="field-grid">
        <label className="field">
          <span>Latitud</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={form.lat}
            onChange={(event) => updateField('lat', event.target.value)}
            placeholder="41.6523"
          />
        </label>

        <label className="field">
          <span>Longitud</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={form.lng}
            onChange={(event) => updateField('lng', event.target.value)}
            placeholder="-4.7245"
          />
        </label>
      </div>

      <div className="pill-row">
        <button
          className="pill-button"
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? 'Cargando...' : 'Usar mi ubicación actual'}
        </button>
      </div>

      {locationPreview ? (
        <div className="mini-map-preview">
          <strong>Ubicación confirmada ✅</strong>
          <p>
            Lat {locationPreview.lat} • Lng {locationPreview.lng}
          </p>
          <a href={locationPreview.mapsUrl} target="_blank" rel="noreferrer">
            Abrir en Google Maps
          </a>
        </div>
      ) : (
        <div className="mini-map-preview mini-map-preview--empty">
          <strong>Ubicación pendiente</strong>
          <p>{LOCATION_REQUIRED_MESSAGE}</p>
        </div>
      )}

      <div className="field-grid">
        <label className="field">
          <span>Rango de precio</span>
          <select
            value={form.precio_rango}
            onChange={(event) => updateField('precio_rango', event.target.value)}
          >
            <option value="€">€</option>
            <option value="€€">€€</option>
            <option value="€€€">€€€</option>
          </select>
        </label>

        <label className="field">
          <span>Foto de portada (URL)</span>
          <input
            type="url"
            value={form.cover_photo_url}
            onChange={(event) => updateField('cover_photo_url', event.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>

      <label className="field">
        <span>Google Maps URL</span>
        <input
          type="url"
          value={form.google_maps_url}
          onChange={(event) => updateField('google_maps_url', event.target.value)}
          placeholder="https://maps.google.com/..."
        />
      </label>

      <label className="field">
        <span>Tags</span>
        <input
          type="text"
          value={form.tags}
          onChange={(event) => updateField('tags', event.target.value)}
          placeholder="croquetas, vermú, terraza"
        />
      </label>

      <label className="field">
        <span>Notas</span>
        <textarea
          rows="4"
          value={form.notas}
          onChange={(event) => updateField('notas', event.target.value)}
          placeholder="Qué hace especial a este sitio"
        />
      </label>

      {status.message ? (
        <div className={`status-banner status-banner--${status.tone || 'info'}`}>
          <strong>{status.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="pill-button" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar restaurante'}
        </button>
      </div>
    </form>
  )
}

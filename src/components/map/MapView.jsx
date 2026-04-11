import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { getMapsProvider, hasValidCoordinates } from '../../lib/maps.js'

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10
const CLUSTER_DISTANCE_PX = 56
const VALLADOLID_CENTER = [41.6523, -4.7245]

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getToneClass(score) {
  if (typeof score !== 'number') {
    return 'leaflet-pin--mid'
  }

  if (score >= 8) {
    return 'leaflet-pin--good'
  }

  if (score >= 5) {
    return 'leaflet-pin--mid'
  }

  return 'leaflet-pin--bad'
}

function buildLeafletPinMarkup(
  marker,
  pinStyle,
  isActive,
  { isDraft = false, isFocus = false } = {},
) {
  const effectivePinStyle = marker.pinStyle || pinStyle
  let content = '<span class="leaflet-pin__dot" aria-hidden="true"></span>'

  if (effectivePinStyle === 'Categoría') {
    content = `<span class="leaflet-pin__emoji">${escapeHtml(marker.categoryIcon || '🍽️')}</span>`
  }

  if (effectivePinStyle === 'Foto') {
    content = marker.cover_photo_url
      ? `<img class="leaflet-pin__photo" src="${escapeHtml(marker.cover_photo_url)}" alt="${escapeHtml(marker.nombre)}" />`
      : '<span class="leaflet-pin__emoji">🍽️</span>'
  }

  if (effectivePinStyle === 'Precio') {
    content = `<span class="leaflet-pin__text">${escapeHtml(marker.precio_rango || '€')}</span>`
  }

  if (effectivePinStyle === 'Score') {
    content = `<span class="leaflet-pin__text">${typeof marker.score === 'number' ? marker.score.toFixed(1) : '0.0'}</span>`
  }

  const classes = [
    'leaflet-pin',
    isFocus ? 'leaflet-pin--focus' : isDraft ? 'leaflet-pin--draft' : getToneClass(marker.score),
    isActive ? 'leaflet-pin--active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return `<div class="${classes}"><div class="leaflet-pin__bubble">${content}</div></div>`
}

function buildLeafletClusterMarkup(cluster, isActive) {
  const classes = [
    'leaflet-pin',
    'leaflet-pin--cluster',
    isActive ? 'leaflet-pin--active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return `<div class="${classes}"><div class="leaflet-pin__bubble"><span class="leaflet-pin__text">${cluster.count}</span></div></div>`
}

function clusterMarkers(markers, map, zoom, selectedMarkerId) {
  if (markers.length <= 1) {
    return markers.map((marker) => ({
      type: 'marker',
      id: marker.id,
      marker,
      isActive: marker.id === selectedMarkerId,
    }))
  }

  const clusters = []

  markers.forEach((marker) => {
    const projectedPoint = map.project([Number(marker.lat), Number(marker.lng)], zoom)
    const matchingCluster = clusters.find(
      (cluster) =>
        Math.hypot(cluster.x - projectedPoint.x, cluster.y - projectedPoint.y) <=
        CLUSTER_DISTANCE_PX,
    )

    if (!matchingCluster) {
      clusters.push({
        x: projectedPoint.x,
        y: projectedPoint.y,
        members: [marker],
      })
      return
    }

    matchingCluster.members.push(marker)
    matchingCluster.x =
      matchingCluster.members.reduce(
        (sum, member) => sum + map.project([Number(member.lat), Number(member.lng)], zoom).x,
        0,
      ) / matchingCluster.members.length
    matchingCluster.y =
      matchingCluster.members.reduce(
        (sum, member) => sum + map.project([Number(member.lat), Number(member.lng)], zoom).y,
        0,
      ) / matchingCluster.members.length
  })

  return clusters.map((cluster) => {
    if (cluster.members.length === 1) {
      const marker = cluster.members[0]
      return {
        type: 'marker',
        id: marker.id,
        marker,
        isActive: marker.id === selectedMarkerId,
      }
    }

    const latlng = map.unproject(L.point(cluster.x, cluster.y), zoom)
    const bounds = L.latLngBounds(
      cluster.members.map((member) => [Number(member.lat), Number(member.lng)]),
    )
    const containsSelected = cluster.members.some(
      (member) => member.id === selectedMarkerId,
    )

    return {
      type: 'cluster',
      id: `cluster:${cluster.members.map((member) => member.id).join(':')}`,
      count: cluster.members.length,
      bounds,
      containsSelected,
      lat: latlng.lat,
      lng: latlng.lng,
      members: cluster.members,
    }
  })
}

export function MapView({
  allowAutoLocate = false,
  center = null,
  className = '',
  emptyDescription,
  emptyTitle,
  focusMarker = null,
  instructionLabel,
  markers = [],
  mode = 'full',
  onLongPress,
  onSelectMarker,
  pinStyle = 'Punto',
  selectedMarkerId = '',
  showTopline = true,
  tempMarker = null,
  zoom = null,
}) {
  const onLongPressRef = useRef(onLongPress)
  const onSelectMarkerRef = useRef(onSelectMarker)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const tileLayerRef = useRef(null)
  const markerLayerRef = useRef(null)
  const hasInitialFitRef = useRef(false)
  const didResolveInitialCenterRef = useRef(false)
  const controlledCenter = useMemo(
    () =>
      hasValidCoordinates(center)
        ? {
            lat: Number(center.lat),
            lng: Number(center.lng),
          }
        : null,
    [center],
  )
  const controlledZoom = Number.isFinite(zoom) ? Number(zoom) : null
  const isControlledViewport =
    Boolean(controlledCenter) && Number.isFinite(controlledZoom)
  const initialZoom = controlledZoom ?? (mode === 'mini' ? 14 : 13)
  const [currentZoom, setCurrentZoom] = useState(initialZoom)
  const effectiveZoom = controlledZoom ?? currentZoom
  const pressStateRef = useRef({
    clientX: 0,
    clientY: 0,
    latlng: null,
    pointerId: null,
    timerId: 0,
  })

  const validMarkers = useMemo(
    () => markers.filter((marker) => hasValidCoordinates(marker)),
    [markers],
  )
  const provider = getMapsProvider()
  const effectiveFocusMarker = useMemo(
    () =>
      hasValidCoordinates(focusMarker)
        ? {
            id: focusMarker.id || 'focus-location',
            nombre: focusMarker.nombre || 'Tu ubicación',
            lat: Number(focusMarker.lat),
            lng: Number(focusMarker.lng),
            score: focusMarker.score ?? null,
            precio_rango: focusMarker.precio_rango || '',
            categoryIcon: focusMarker.categoryIcon || '📍',
            cover_photo_url: focusMarker.cover_photo_url || '',
          }
        : null,
    [focusMarker],
  )
  const draftMarker = useMemo(
    () =>
      hasValidCoordinates(tempMarker)
        ? {
            id: tempMarker.id || 'draft-location',
            nombre: tempMarker.nombre || 'Ubicación seleccionada',
            lat: Number(tempMarker.lat),
            lng: Number(tempMarker.lng),
            score: tempMarker.score ?? 0,
            precio_rango: tempMarker.precio_rango || '€',
            categoryIcon: tempMarker.categoryIcon || '📍',
            cover_photo_url: tempMarker.cover_photo_url || '',
          }
        : null,
    [tempMarker],
  )

  useEffect(() => {
    onLongPressRef.current = onLongPress
  }, [onLongPress])

  useEffect(() => {
    onSelectMarkerRef.current = onSelectMarker
  }, [onSelectMarker])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = L.map(mapContainerRef.current, {
      attributionControl: false,
      doubleClickZoom: !isControlledViewport,
      keyboard: mode === 'full' && !isControlledViewport,
      scrollWheelZoom: mode === 'full' && !isControlledViewport,
      touchZoom: !isControlledViewport,
      zoomControl: mode === 'full' && !isControlledViewport,
    })

    mapRef.current = map
    tileLayerRef.current = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
      },
    )
    tileLayerRef.current.addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    map.setView(
      controlledCenter
        ? [controlledCenter.lat, controlledCenter.lng]
        : VALLADOLID_CENTER,
      initialZoom,
    )

    const clearLongPress = () => {
      if (pressStateRef.current.timerId) {
        window.clearTimeout(pressStateRef.current.timerId)
        pressStateRef.current.timerId = 0
      }
    }

    const container = map.getContainer()

    const shouldIgnoreTarget = (target) =>
      Boolean(
        target.closest(
          '.leaflet-control-container, .leaflet-marker-icon, .leaflet-popup, .leaflet-pin-icon',
        ),
      )

    const handlePointerDown = (event) => {
      if (!onLongPressRef.current || shouldIgnoreTarget(event.target)) {
        return
      }

      clearLongPress()
      const containerPoint = map.mouseEventToContainerPoint(event)
      const latlng = map.containerPointToLatLng(containerPoint)

      pressStateRef.current.clientX = event.clientX
      pressStateRef.current.clientY = event.clientY
      pressStateRef.current.latlng = latlng
      pressStateRef.current.pointerId = event.pointerId
      pressStateRef.current.timerId = window.setTimeout(() => {
        if (!pressStateRef.current.latlng) {
          return
        }

        onLongPressRef.current({
          lat: pressStateRef.current.latlng.lat,
          lng: pressStateRef.current.latlng.lng,
        })
        clearLongPress()
      }, LONG_PRESS_MS)
    }

    const cancelLongPress = () => {
      pressStateRef.current.latlng = null
      pressStateRef.current.pointerId = null
      clearLongPress()
    }

    const handlePointerMove = (event) => {
      if (!pressStateRef.current.timerId) {
        return
      }

      const distance = Math.hypot(
        event.clientX - pressStateRef.current.clientX,
        event.clientY - pressStateRef.current.clientY,
      )

      if (distance > MOVE_CANCEL_PX) {
        cancelLongPress()
      }
    }

    const handlePointerUp = () => {
      cancelLongPress()
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerUp)
    container.addEventListener('pointercancel', handlePointerUp)
    container.addEventListener('pointerleave', handlePointerUp)
    map.on('dragstart', cancelLongPress)
    map.on('movestart', cancelLongPress)
    map.on('zoomstart', cancelLongPress)
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    return () => {
      clearLongPress()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerUp)
      container.removeEventListener('pointercancel', handlePointerUp)
      container.removeEventListener('pointerleave', handlePointerUp)
      map.off()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markerLayerRef.current = null
      hasInitialFitRef.current = false
      didResolveInitialCenterRef.current = false
    }
  }, [controlledCenter, initialZoom, isControlledViewport, mode])

  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      mode !== 'full' ||
      !allowAutoLocate ||
      didResolveInitialCenterRef.current ||
      isControlledViewport
    ) {
      return
    }

    didResolveInitialCenterRef.current = true

    if (!navigator.geolocation) {
      map.setView(VALLADOLID_CENTER, 13)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          14,
        )
      },
      () => {
        map.setView(VALLADOLID_CENTER, 13)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
      },
    )
  }, [allowAutoLocate, isControlledViewport, mode])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !controlledCenter) {
      return
    }

    map.setView(
      [controlledCenter.lat, controlledCenter.lng],
      controlledZoom ?? map.getZoom(),
      {
        animate: false,
      },
    )
  }, [controlledCenter, controlledZoom])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)
  })

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current

    if (!map || !markerLayer) {
      return
    }

    markerLayer.clearLayers()

    const renderItems =
      mode === 'full'
        ? clusterMarkers(validMarkers, map, effectiveZoom, selectedMarkerId)
        : validMarkers.map((marker) => ({
            type: 'marker',
            id: marker.id,
            marker,
            isActive: marker.id === selectedMarkerId,
          }))

    renderItems.forEach((item) => {
      if (item.type === 'cluster') {
        const clusterMarker = L.marker([Number(item.lat), Number(item.lng)], {
          icon: L.divIcon({
            className: 'leaflet-pin-icon',
            html: buildLeafletClusterMarkup(item, item.containsSelected),
            iconAnchor: [18, 18],
            iconSize: [40, 40],
          }),
          riseOnHover: true,
        })

        if (!isControlledViewport) {
          clusterMarker.on('click', () => {
            map.fitBounds(item.bounds, {
              maxZoom: Math.min(map.getZoom() + 2, 18),
              padding: [32, 32],
            })
          })
        }
        clusterMarker.addTo(markerLayer)
        return
      }

      const icon = L.divIcon({
        className: 'leaflet-pin-icon',
        html: buildLeafletPinMarkup(
          item.marker,
          pinStyle,
          item.isActive,
        ),
        iconAnchor: [18, 18],
        iconSize: [36, 36],
      })

      const markerInstance = L.marker(
        [Number(item.marker.lat), Number(item.marker.lng)],
        {
          icon,
          riseOnHover: true,
        },
      )

      markerInstance.on('click', () => onSelectMarkerRef.current?.(item.marker.id))
      markerInstance.addTo(markerLayer)
    })

    if (effectiveFocusMarker) {
      L.marker([Number(effectiveFocusMarker.lat), Number(effectiveFocusMarker.lng)], {
        icon: L.divIcon({
          className: 'leaflet-pin-icon',
          html: buildLeafletPinMarkup(effectiveFocusMarker, 'Punto', false, {
            isFocus: true,
          }),
          iconAnchor: [18, 18],
          iconSize: [36, 36],
        }),
        riseOnHover: true,
      }).addTo(markerLayer)
    }

    if (draftMarker) {
      L.marker([Number(draftMarker.lat), Number(draftMarker.lng)], {
        icon: L.divIcon({
          className: 'leaflet-pin-icon',
          html: buildLeafletPinMarkup(draftMarker, 'Punto', true, {
            isDraft: true,
          }),
          iconAnchor: [18, 18],
          iconSize: [36, 36],
        }),
        riseOnHover: true,
      }).addTo(markerLayer)
    }
  }, [
    draftMarker,
    effectiveZoom,
    effectiveFocusMarker,
    isControlledViewport,
    mode,
    pinStyle,
    selectedMarkerId,
    validMarkers,
  ])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    const points = [
      ...validMarkers.map((marker) => [Number(marker.lat), Number(marker.lng)]),
      ...(effectiveFocusMarker
        ? [[Number(effectiveFocusMarker.lat), Number(effectiveFocusMarker.lng)]]
        : []),
      ...(draftMarker ? [[Number(draftMarker.lat), Number(draftMarker.lng)]] : []),
    ]

    if (isControlledViewport) {
      return
    }

    if (points.length === 0) {
      if (mode === 'mini') {
        map.setView(VALLADOLID_CENTER, 13)
      }
      return
    }

    if (mode === 'mini') {
      if (draftMarker) {
        map.setView([Number(draftMarker.lat), Number(draftMarker.lng)], 15)
      } else if (points.length === 1) {
        map.setView(points[0], mode === 'mini' ? 15 : 14)
      } else {
        map.fitBounds(points, {
          maxZoom: mode === 'mini' ? 15 : 16,
          padding: mode === 'mini' ? [18, 18] : [36, 36],
        })
      }

      hasInitialFitRef.current = true
      return
    }

    if (!hasInitialFitRef.current) {
      hasInitialFitRef.current = true
      return
    }

    if (selectedMarkerId) {
      const selectedMarker = validMarkers.find((marker) => marker.id === selectedMarkerId)

      if (selectedMarker) {
        map.panTo([Number(selectedMarker.lat), Number(selectedMarker.lng)])
      }
    }
  }, [
    draftMarker,
    effectiveFocusMarker,
    isControlledViewport,
    mode,
    selectedMarkerId,
    validMarkers,
  ])

  return (
    <div className={`map-view map-view--${mode}${className ? ` ${className}` : ''}`}>
      {showTopline ? (
        <div className="map-view__topline">
          <span className="map-provider-badge">
            {provider === 'leaflet-osm' ? 'Leaflet + OpenStreetMap' : 'Mapa'}
          </span>
          <span>{instructionLabel}</span>
        </div>
      ) : null}

      <div className="map-view__surface map-view__surface--leaflet" role="application" aria-label="Mapa interactivo de restaurantes">
        <div className="map-view__leaflet" ref={mapContainerRef} />
        <div className="map-view__attribution">Datos © OpenStreetMap</div>
        {validMarkers.length === 0 && !draftMarker ? (
          <div className="map-view__empty">
            <strong>{emptyTitle || 'Sin puntos todavía'}</strong>
            <p>
              {emptyDescription ||
                'Mantén pulsado 500 ms para fijar una ubicación deliberada.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

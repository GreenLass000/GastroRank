import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { formatScore } from '../../lib/format.js'
import { hasValidCoordinates } from '../../lib/maps.js'
import { getScoreTone } from '../../lib/scoring.js'

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

function normalizePinStyle(pinStyle) {
  if (pinStyle === 'Score') {
    return 'Puntuación'
  }

  return pinStyle || 'Puntuación'
}

function getToneClass(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'leaflet-pin--neutral'
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
  const effectivePinStyle = normalizePinStyle(marker.pinStyle || pinStyle)
  let content = '<span class="leaflet-pin__dot" aria-hidden="true"></span>'

  if (effectivePinStyle === 'Nombre') {
    content = `<span class="leaflet-pin__name">${escapeHtml(marker.nombre || 'Restaurante')}</span>`
  }

  if (effectivePinStyle === 'Categoría') {
    content = `<span class="leaflet-pin__emoji">${escapeHtml(marker.categoryIcon || '🍽️')}</span>`
  }

  if (effectivePinStyle === 'Precio') {
    content = `<span class="leaflet-pin__text">${escapeHtml(marker.precio_rango || '€')}</span>`
  }

  if (effectivePinStyle === 'Puntuación') {
    content = `<span class="leaflet-pin__text">${typeof marker.score === 'number' ? formatScore(marker.score) : 'N/R'}</span>`
  }

  const classes = [
    'leaflet-pin',
    isFocus ? 'leaflet-pin--focus' : isDraft ? 'leaflet-pin--draft' : getToneClass(marker.score),
    effectivePinStyle === 'Nombre' ? 'leaflet-pin--name' : '',
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

function createPopupContent(marker, onPopupAction) {
  const container = document.createElement('div')
  container.className = 'map-popup'

  const title = document.createElement('strong')
  title.className = 'map-popup__title'
  title.textContent = marker.nombre || 'Restaurante'
  container.appendChild(title)

  const metaRow = document.createElement('div')
  metaRow.className = 'map-popup__meta'
  const scoreBadge = document.createElement('span')
  scoreBadge.className = `ranking-card__score ranking-card__score--${getScoreTone(marker.score)}`
  scoreBadge.textContent =
    typeof marker.score === 'number' ? formatScore(marker.score) : 'N/R'
  metaRow.appendChild(scoreBadge)
  container.appendChild(metaRow)

  const action = document.createElement('button')
  action.type = 'button'
  action.className = 'map-popup__action'
  action.textContent = 'Ver más →'
  action.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onPopupAction?.(marker.id)
  })
  container.appendChild(action)

  return container
}

function getViewportSnapshot(map) {
  const center = map.getCenter()
  const bounds = map.getBounds()

  return {
    center: {
      lat: Number(center.lat),
      lng: Number(center.lng),
    },
    zoom: map.getZoom(),
    bounds: {
      north: Number(bounds.getNorth()),
      south: Number(bounds.getSouth()),
      east: Number(bounds.getEast()),
      west: Number(bounds.getWest()),
    },
  }
}

export function MapView({
  center = null,
  children = null,
  className = '',
  emptyDescription,
  emptyTitle,
  focusMarker = null,
  instructionLabel,
  markers = [],
  mode = 'full',
  onLongPress,
  onPopupAction,
  onSelectMarker,
  onViewportChange,
  pinStyle = 'Punto',
  popupMarkerId = '',
  selectedMarkerId = '',
  showAttribution = false,
  showTopline = true,
  tempMarker = null,
  viewportAnimation = 'set',
  viewportKey = '',
  zoom = null,
}) {
  const onLongPressRef = useRef(onLongPress)
  const onPopupActionRef = useRef(onPopupAction)
  const onSelectMarkerRef = useRef(onSelectMarker)
  const onViewportChangeRef = useRef(onViewportChange)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const tileLayerRef = useRef(null)
  const markerLayerRef = useRef(null)
  const hasInitialFitRef = useRef(false)
  const latestViewportRequestRef = useRef('')
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
  const initialZoom = controlledZoom ?? (mode === 'mini' ? 14 : 13)
  const initialCenterRef = useRef(controlledCenter)
  const initialZoomRef = useRef(initialZoom)
  const [currentZoom, setCurrentZoom] = useState(initialZoom)
  const effectiveZoom = controlledZoom ?? currentZoom
  const pressStateRef = useRef({
    clientX: 0,
    clientY: 0,
    latlng: null,
    pointerId: null,
    timerId: 0,
  })
  const resizeFrameRef = useRef(0)
  const lastContainerSizeRef = useRef({ width: 0, height: 0 })

  const validMarkers = useMemo(
    () => markers.filter((marker) => hasValidCoordinates(marker)),
    [markers],
  )
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
            score: tempMarker.score ?? null,
            precio_rango: tempMarker.precio_rango || '€',
            categoryIcon: tempMarker.categoryIcon || '📍',
          }
        : null,
    [tempMarker],
  )

  useEffect(() => {
    onLongPressRef.current = onLongPress
  }, [onLongPress])

  useEffect(() => {
    onPopupActionRef.current = onPopupAction
  }, [onPopupAction])

  useEffect(() => {
    onSelectMarkerRef.current = onSelectMarker
  }, [onSelectMarker])

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange
  }, [onViewportChange])

  useEffect(() => {
    initialCenterRef.current = controlledCenter
  }, [controlledCenter])

  useEffect(() => {
    initialZoomRef.current = initialZoom
  }, [initialZoom])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = L.map(mapContainerRef.current, {
      attributionControl: false,
      doubleClickZoom: mode === 'full',
      keyboard: mode === 'full',
      scrollWheelZoom: mode === 'full',
      touchZoom: mode === 'full',
      zoomControl: mode === 'full',
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
      initialCenterRef.current
        ? [initialCenterRef.current.lat, initialCenterRef.current.lng]
        : VALLADOLID_CENTER,
      initialZoomRef.current,
    )

    const emitViewportChange = () => {
      onViewportChangeRef.current?.(getViewportSnapshot(map))
    }

    const scheduleInvalidateSize = ({ emitViewport = false } = {}) => {
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = 0
        map.invalidateSize(false)

        if (emitViewport) {
          emitViewportChange()
        }
      })
    }

    const clearLongPress = () => {
      if (pressStateRef.current.timerId) {
        window.clearTimeout(pressStateRef.current.timerId)
        pressStateRef.current.timerId = 0
      }
    }

    const container = map.getContainer()
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

    const disableSingleFingerMapDrag = () => {
      if (mode !== 'full' || !isTouchDevice) {
        return
      }

      map.dragging?.disable()
      map.touchZoom?.disable()
    }

    const enableTwoFingerMapDrag = () => {
      if (mode !== 'full' || !isTouchDevice) {
        return
      }

      map.dragging?.enable()
      map.touchZoom?.enable()
    }

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

    const handleTouchStart = (event) => {
      if (event.touches.length >= 2) {
        enableTwoFingerMapDrag()
        return
      }

      disableSingleFingerMapDrag()
    }

    const handleTouchEnd = (event) => {
      if (event.touches.length >= 2) {
        enableTwoFingerMapDrag()
        return
      }

      disableSingleFingerMapDrag()
    }

    disableSingleFingerMapDrag()

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerUp)
    container.addEventListener('pointercancel', handlePointerUp)
    container.addEventListener('pointerleave', handlePointerUp)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    map.on('dragstart', cancelLongPress)
    map.on('movestart', cancelLongPress)
    map.on('zoomstart', cancelLongPress)
    map.on('moveend', emitViewportChange)
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
      emitViewportChange()
    })

    let resizeObserver = null

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        const nextWidth = Math.round(entry?.contentRect?.width ?? 0)
        const nextHeight = Math.round(entry?.contentRect?.height ?? 0)

        if (nextWidth <= 0 || nextHeight <= 0) {
          return
        }

        const { width, height } = lastContainerSizeRef.current

        if (width === nextWidth && height === nextHeight) {
          return
        }

        lastContainerSizeRef.current = {
          width: nextWidth,
          height: nextHeight,
        }
        scheduleInvalidateSize({ emitViewport: true })
      })
      resizeObserver.observe(container)
    } else {
      scheduleInvalidateSize({ emitViewport: true })
    }

    return () => {
      clearLongPress()
      resizeObserver?.disconnect()
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = 0
      }
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerUp)
      container.removeEventListener('pointercancel', handlePointerUp)
      container.removeEventListener('pointerleave', handlePointerUp)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
      map.off()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markerLayerRef.current = null
      hasInitialFitRef.current = false
      latestViewportRequestRef.current = ''
    }
  }, [mode])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !controlledCenter) {
      return
    }

    const requestKey = [
      controlledCenter.lat.toFixed(6),
      controlledCenter.lng.toFixed(6),
      controlledZoom ?? '',
      viewportAnimation,
      viewportKey,
    ].join(':')

    if (latestViewportRequestRef.current === requestKey) {
      return
    }

    latestViewportRequestRef.current = requestKey
    const targetZoom = controlledZoom ?? map.getZoom()

    if (viewportAnimation === 'fly') {
      map.flyTo([controlledCenter.lat, controlledCenter.lng], targetZoom, {
        duration: 0.45,
      })
      return
    }

    map.setView([controlledCenter.lat, controlledCenter.lng], targetZoom, {
      animate: false,
    })
  }, [controlledCenter, controlledZoom, viewportAnimation, viewportKey])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current

    if (!map || !markerLayer) {
      return
    }

    markerLayer.clearLayers()

    const popupTargetId = popupMarkerId || selectedMarkerId
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

        clusterMarker.on('click', () => {
          map.fitBounds(item.bounds, {
            maxZoom: Math.min(map.getZoom() + 2, 18),
            padding: [32, 32],
          })
        })
        clusterMarker.addTo(markerLayer)
        return
      }

      const icon = L.divIcon({
        className: 'leaflet-pin-icon',
        html: buildLeafletPinMarkup(item.marker, pinStyle, item.isActive),
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

      if (item.marker.id === popupTargetId) {
        markerInstance.bindPopup(
          createPopupContent(item.marker, (markerId) =>
            onPopupActionRef.current?.(markerId),
          ),
          {
            autoPan: true,
            closeButton: false,
            className: 'leaflet-restaurant-popup',
            offset: [0, -18],
          },
        )
      }

      markerInstance.addTo(markerLayer)

      if (item.marker.id === popupTargetId) {
        markerInstance.openPopup()
      }
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
    mode,
    pinStyle,
    popupMarkerId,
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

    if (controlledCenter) {
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
        map.setView(points[0], 15)
      } else {
        map.fitBounds(points, {
          maxZoom: 15,
          padding: [18, 18],
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
  }, [controlledCenter, draftMarker, effectiveFocusMarker, mode, selectedMarkerId, validMarkers])

  return (
    <div className={`map-view map-view--${mode}${className ? ` ${className}` : ''}`}>
      {showTopline ? (
        <div className="map-view__topline">
          <span>{instructionLabel || 'Mapa'}</span>
        </div>
      ) : null}

      <div
        className="map-view__surface map-view__surface--leaflet"
        role="application"
        aria-label="Mapa interactivo de restaurantes"
      >
        <div className="map-view__leaflet" ref={mapContainerRef} />
        {showAttribution ? (
          <div className="map-view__attribution">Datos © OpenStreetMap</div>
        ) : null}
        {validMarkers.length === 0 && !draftMarker ? (
          <div className="map-view__empty">
            <strong>{emptyTitle || 'Sin puntos todavía'}</strong>
            <p>
              {emptyDescription ||
                'Mantén pulsado 500 ms para fijar una ubicación deliberada.'}
            </p>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

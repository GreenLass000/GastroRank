import { useEffect } from 'react'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { STORAGE_KEYS } from '../lib/constants.js'
import { FiltersContext } from './appStateContexts.js'
import {
  DEFAULT_FILTERS,
  DEFAULT_MAP_CENTER,
  normalizePinStyleOverrides,
  sanitizePinStyle,
} from './appStateShared.js'

export function FiltersProvider({ children }) {
  const [activeFilters, setActiveFilters] = usePersistentState(
    STORAGE_KEYS.filters,
    DEFAULT_FILTERS,
  )
  const [defaultPinStyle, setDefaultPinStyleState] = usePersistentState(
    STORAGE_KEYS.defaultPinStyle,
    sanitizePinStyle('Score'),
  )
  const [restaurantPinStyleOverrides, setRestaurantPinStyleOverrides] =
    usePersistentState(STORAGE_KEYS.restaurantPinStyleOverrides, {})
  const [filterOrigin, setFilterOrigin] = usePersistentState(
    STORAGE_KEYS.filterOrigin,
    {
      ...DEFAULT_MAP_CENTER,
      source: 'fallback',
    },
  )

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFilterOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'geolocation',
        })
      },
      () => {
        setFilterOrigin({
          ...DEFAULT_MAP_CENTER,
          source: 'fallback',
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
      },
    )
  }, [setFilterOrigin])

  function setDefaultPinStyle(style) {
    setDefaultPinStyleState(sanitizePinStyle(style))
  }

  function setRestaurantPinStyle(restaurantId, style) {
    if (!restaurantId) {
      return
    }

    setRestaurantPinStyleOverrides((current) => ({
      ...normalizePinStyleOverrides(current),
      [restaurantId]: sanitizePinStyle(style),
    }))
  }

  function clearRestaurantPinStyle(restaurantId) {
    if (!restaurantId) {
      return
    }

    setRestaurantPinStyleOverrides((current) => {
      const nextOverrides = { ...normalizePinStyleOverrides(current) }
      delete nextOverrides[restaurantId]
      return nextOverrides
    })
  }

  const value = {
    activeFilters,
    setActiveFilters,
    defaultPinStyle: sanitizePinStyle(defaultPinStyle),
    restaurantPinStyleOverrides: normalizePinStyleOverrides(
      restaurantPinStyleOverrides,
    ),
    filterOrigin,
    setFilterOrigin,
    setDefaultPinStyle,
    setRestaurantPinStyle,
    clearRestaurantPinStyle,
  }

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

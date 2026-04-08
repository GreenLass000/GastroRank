import { useEffect, useState } from 'react'
import { createSeedData } from '../data/seed.js'
import { AppStateContext } from '../context/appStateContext.js'
import {
  createCategory as createCategoryRequest,
  createDishEntry as createDishEntryRequest,
  createDishType as createDishTypeRequest,
  createGroup as createGroupRequest,
  createRestaurant as createRestaurantRequest,
  fetchBootstrapData,
  updateCategory as updateCategoryRequest,
  updateDishEntry as updateDishEntryRequest,
  updateDishType as updateDishTypeRequest,
  updateGroup as updateGroupRequest,
  updateRestaurant as updateRestaurantRequest,
  updateUser as updateUserRequest,
} from '../lib/api.js'
import {
  buildActiveFilterChips,
  buildAvailableFilterOptions,
  DEFAULT_FILTERS,
  filterDishEntries,
  normalizeFilters,
} from '../lib/filters.js'
import { PIN_STYLES, STORAGE_KEYS } from '../lib/constants.js'
import { DEFAULT_MAP_CENTER } from '../lib/maps.js'
import {
  buildCategoryRankings,
  buildDishTypeRankings,
  buildGlobalRankings,
  buildRestaurantRankings,
} from '../lib/ranking.js'
import { calculateAverageScore, calculateGeneralScore } from '../lib/scoring.js'
import { usePersistentState } from '../hooks/usePersistentState.js'

function hydrateState() {
  const seed = createSeedData()
  const dishEntries = seed.dishEntries.map((entry) => ({
    ...entry,
    puntuacion_general: calculateGeneralScore(entry),
  }))

  return {
    ...seed,
    dishEntries,
    restaurants: enrichRestaurants(seed.restaurants, dishEntries),
  }
}

function buildEntriesWithLabels(entries, restaurants, dishTypes) {
  return entries.map((entry) => ({
    ...entry,
    restaurantName:
      restaurants.find((restaurant) => restaurant.id === entry.restaurant_id)?.nombre ??
      'Restaurante',
    dishTypeName:
      dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id)?.nombre ??
      'Plato',
  }))
}

function buildRestaurantsByScore(restaurants) {
  return [...restaurants].sort(
    (left, right) => right.restaurant_score - left.restaurant_score,
  )
}

function enrichRestaurants(restaurants, dishEntries) {
  return restaurants.map((restaurant) => {
    const restaurantEntries = dishEntries.filter(
      (entry) => entry.restaurant_id === restaurant.id,
    )

    return {
      ...restaurant,
      restaurant_score: calculateAverageScore(restaurantEntries),
      total_entries: restaurantEntries.length,
    }
  })
}

function replaceRecordById(items, nextRecord) {
  return items.map((item) => (item.id === nextRecord.id ? nextRecord : item))
}

function buildRankingContextsForEntries({
  categories,
  currentGroupId,
  currentUserId,
  dishTypes,
  entries,
  restaurants,
}) {
  return ['private', 'group', 'public'].reduce((acc, contextId) => {
    acc[contextId] = {
      dishType: buildDishTypeRankings({
        categories,
        currentGroupId,
        currentUserId,
        dishTypes,
        entries,
        restaurants,
        contextId,
      }),
      category: buildCategoryRankings({
        categories,
        currentGroupId,
        currentUserId,
        entries,
        restaurants,
        contextId,
      }),
      restaurant: buildRestaurantRankings({
        currentGroupId,
        currentUserId,
        entries,
        restaurants,
        contextId,
      }),
      global: buildGlobalRankings({
        currentGroupId,
        currentUserId,
        entries,
        restaurants,
        contextId,
      }),
    }

    return acc
  }, {})
}

function buildFilteredRestaurants(restaurants, filteredEntries) {
  const filteredRestaurantIds = new Set(
    filteredEntries.map((entry) => entry.restaurant_id),
  )

  return restaurants
    .filter((restaurant) => filteredRestaurantIds.has(restaurant.id))
    .map((restaurant) => {
      const restaurantEntries = filteredEntries.filter(
        (entry) => entry.restaurant_id === restaurant.id,
      )

      return {
        ...restaurant,
        restaurant_score: calculateAverageScore(restaurantEntries),
        total_entries: restaurantEntries.length,
      }
    })
}

function buildDerivedState(state, filters, filterOrigin) {
  const currentUser = state.users[0]
  const groupsForCurrentUser = state.groups.filter((group) =>
    state.groupMembers.some(
      (member) =>
        member.group_id === group.id &&
        member.user_id === currentUser.id &&
        member.status === 'active',
    ),
  )
  const currentGroup = groupsForCurrentUser[0] ?? state.groups[0] ?? null
  const currentUserEntries = state.dishEntries.filter(
    (entry) => entry.created_by_user_id === currentUser.id,
  )
  const latestEntries = buildEntriesWithLabels(
    [...state.dishEntries]
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .slice(0, 5),
    state.restaurants,
    state.dishTypes,
  )
  const rankingContexts = buildRankingContextsForEntries({
    categories: state.categories,
    currentGroupId: currentGroup?.id ?? null,
    currentUserId: currentUser.id,
    dishTypes: state.dishTypes,
    entries: state.dishEntries,
    restaurants: state.restaurants,
  })
  const restaurantsByScore = buildRestaurantsByScore(state.restaurants)
  const restaurantsById = Object.fromEntries(
    state.restaurants.map((restaurant) => [restaurant.id, restaurant]),
  )
  const normalizedFilters = normalizeFilters(filters, state.dishTypes)
  const filteredDishEntries = filterDishEntries({
    dishTypes: state.dishTypes,
    entries: state.dishEntries,
    filters: normalizedFilters,
    filterOrigin,
    restaurantsById,
  })
  const filteredRestaurants = buildFilteredRestaurants(
    state.restaurants,
    filteredDishEntries,
  )
  const filteredLatestEntries = buildEntriesWithLabels(
    [...filteredDishEntries]
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .slice(0, 5),
    state.restaurants,
    state.dishTypes,
  )
  const filteredRankingContexts = buildRankingContextsForEntries({
    categories: state.categories,
    currentGroupId: currentGroup?.id ?? null,
    currentUserId: currentUser.id,
    dishTypes: state.dishTypes,
    entries: filteredDishEntries,
    restaurants: filteredRestaurants,
  })
  const activeFilterChips = buildActiveFilterChips({
    categories: state.categories,
    dishTypes: state.dishTypes,
    filters: normalizedFilters,
    users: state.users,
  })
  const availableFilterOptions = buildAvailableFilterOptions({
    categories: state.categories,
    dishTypes: state.dishTypes,
    entries: state.dishEntries,
    users: state.users,
  })

  return {
    currentUser,
    currentGroup,
    currentUserEntries,
    groupsForCurrentUser,
    latestEntries,
    rankingContexts,
    filteredDishEntries,
    filteredLatestEntries,
    filteredRankingContexts,
    filteredRestaurantsByScore: buildRestaurantsByScore(filteredRestaurants),
    activeFilters: normalizedFilters,
    activeFilterChips,
    availableFilterOptions,
    filtersCount: activeFilterChips.length,
    hasActiveFilters: activeFilterChips.length > 0,
    filterOrigin,
    filterOriginLabel:
      filterOrigin.source === 'geolocation'
        ? 'tu ubicación actual'
        : 'Valladolid',
    profileStats: {
      totalPlatos: currentUserEntries.length,
      totalRestaurantes: new Set(
        currentUserEntries.map((entry) => entry.restaurant_id),
      ).size,
      grupos: groupsForCurrentUser.length,
    },
    restaurantsByScore,
  }
}

function normalizePinStyle(style) {
  return PIN_STYLES.includes(style) ? style : PIN_STYLES[0]
}

function normalizePinStyleOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(overrides).filter(([, style]) => PIN_STYLES.includes(style)),
  )
}

export function AppStateProvider({ children }) {
  const [state, setState] = useState(hydrateState)
  const [activeFilters, setActiveFilters] = usePersistentState(
    STORAGE_KEYS.filters,
    DEFAULT_FILTERS,
  )
  const [defaultPinStyle, setDefaultPinStyleState] = usePersistentState(
    STORAGE_KEYS.defaultPinStyle,
    PIN_STYLES[0],
  )
  const [restaurantPinStyleOverrides, setRestaurantPinStyleOverrides] =
    usePersistentState(STORAGE_KEYS.restaurantPinStyleOverrides, {})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dataSource, setDataSource] = useState('seed')
  const [filterOrigin, setFilterOrigin] = useState({
    ...DEFAULT_MAP_CENTER,
    source: 'fallback',
  })
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const derivedState = buildDerivedState(state, activeFilters, filterOrigin)

  function clearToast() {
    setToast({ message: '', tone: 'success' })
  }

  function applyFilters(nextFilters) {
    setActiveFilters(normalizeFilters(nextFilters, state.dishTypes))
  }

  function resetFilters() {
    setActiveFilters(DEFAULT_FILTERS)
  }

  function removeFilter(filterKey, value) {
    setActiveFilters((current) => {
      const nextFilters = normalizeFilters(current, state.dishTypes)

      if (Array.isArray(nextFilters[filterKey])) {
        return normalizeFilters(
          {
            ...nextFilters,
            [filterKey]: nextFilters[filterKey].filter((item) => item !== value),
          },
          state.dishTypes,
        )
      }

      if (typeof nextFilters[filterKey] === 'boolean') {
        return normalizeFilters(
          {
            ...nextFilters,
            [filterKey]: false,
          },
          state.dishTypes,
        )
      }

      return normalizeFilters(
        {
          ...nextFilters,
          [filterKey]: filterKey === 'minimumScore' ? 0 : '',
        },
        state.dishTypes,
      )
    })
  }

  function setDefaultPinStyle(style) {
    setDefaultPinStyleState(normalizePinStyle(style))
  }

  function setRestaurantPinStyle(restaurantId, style) {
    if (!restaurantId) {
      return
    }

    setRestaurantPinStyleOverrides((current) => ({
      ...normalizePinStyleOverrides(current),
      [restaurantId]: normalizePinStyle(style),
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

  function updateRestaurantsFromEntries(restaurants, dishEntries) {
    return enrichRestaurants(restaurants, dishEntries)
  }

  async function createRestaurant(payload) {
    const response = await createRestaurantRequest(payload)

    if (!response?.restaurant) {
      throw new Error('La API no devolvió el restaurante creado.')
    }

    const createdRestaurant = {
      ...response.restaurant,
      restaurant_score: 0,
      total_entries: 0,
    }

    setState((current) => ({
      ...current,
      restaurants: [...current.restaurants, createdRestaurant],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateRestaurant(restaurantId, payload) {
    const response = await updateRestaurantRequest(restaurantId, payload)

    if (!response?.restaurant) {
      throw new Error('La API no devolvió el restaurante actualizado.')
    }

    setState((current) => ({
      ...current,
      restaurants: updateRestaurantsFromEntries(
        replaceRecordById(current.restaurants, {
          ...response.restaurant,
          restaurant_score:
            current.restaurants.find((item) => item.id === restaurantId)
              ?.restaurant_score ?? 0,
          total_entries:
            current.restaurants.find((item) => item.id === restaurantId)
              ?.total_entries ?? 0,
        }),
        current.dishEntries,
      ),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function createGroup(payload) {
    const response = await createGroupRequest(payload)

    if (!response?.group || !response?.groupMember) {
      throw new Error('La API no devolvió el grupo creado correctamente.')
    }

    setState((current) => ({
      ...current,
      groups: [...current.groups, response.group],
      groupMembers: [...current.groupMembers, response.groupMember],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateGroup(groupId, payload) {
    const response = await updateGroupRequest(groupId, payload)

    if (!response?.group) {
      throw new Error('La API no devolvió el grupo actualizado.')
    }

    setState((current) => ({
      ...current,
      groups: replaceRecordById(current.groups, response.group),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function createCategory(payload) {
    const response = await createCategoryRequest(payload)

    if (!response?.category) {
      throw new Error('La API no devolvió la categoría creada.')
    }

    setState((current) => ({
      ...current,
      categories: [...current.categories, response.category],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateCategory(categoryId, payload) {
    const response = await updateCategoryRequest(categoryId, payload)

    if (!response?.category) {
      throw new Error('La API no devolvió la categoría actualizada.')
    }

    setState((current) => ({
      ...current,
      categories: replaceRecordById(current.categories, response.category),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function createDishType(payload) {
    const response = await createDishTypeRequest(payload)

    if (!response?.dishType) {
      throw new Error('La API no devolvió el tipo de plato creado.')
    }

    setState((current) => ({
      ...current,
      dishTypes: [...current.dishTypes, response.dishType],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateDishType(dishTypeId, payload) {
    const response = await updateDishTypeRequest(dishTypeId, payload)

    if (!response?.dishType) {
      throw new Error('La API no devolvió el tipo de plato actualizado.')
    }

    setState((current) => ({
      ...current,
      dishTypes: replaceRecordById(current.dishTypes, response.dishType),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function createDishEntry(payload) {
    const response = await createDishEntryRequest(payload)

    if (!response?.dishEntry) {
      throw new Error('La API no devolvió la entrada creada.')
    }

    const createdEntry = response.dishEntry

    setState((current) => {
      const nextDishEntries = [...current.dishEntries, createdEntry]

      return {
        ...current,
        dishEntries: nextDishEntries,
        restaurants: updateRestaurantsFromEntries(
          current.restaurants,
          nextDishEntries,
        ),
      }
    })
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateDishEntry(dishEntryId, payload) {
    const response = await updateDishEntryRequest(dishEntryId, payload)

    if (!response?.dishEntry) {
      throw new Error('La API no devolvió la valoración actualizada.')
    }

    setState((current) => {
      const nextDishEntries = replaceRecordById(
        current.dishEntries,
        response.dishEntry,
      )

      return {
        ...current,
        dishEntries: nextDishEntries,
        restaurants: updateRestaurantsFromEntries(
          current.restaurants,
          nextDishEntries,
        ),
      }
    })
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateUser(userId, payload) {
    const response = await updateUserRequest(userId, payload)

    if (!response?.user) {
      throw new Error('La API no devolvió el perfil actualizado.')
    }

    setState((current) => ({
      ...current,
      users: replaceRecordById(current.users, response.user),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  useEffect(() => {
    let cancelled = false

    async function loadRemoteState() {
      try {
        setIsLoading(true)
        const remoteData = await fetchBootstrapData()

        if (cancelled) {
          return
        }

        setState(hydrateStateFromData(remoteData))
        setDataSource('api')
        setLoadError('')
      } catch (error) {
        if (cancelled) {
          return
        }

        const reason =
          error instanceof Error ? error.message : 'No se pudo conectar con la API.'
        setState(hydrateState())
        setDataSource('seed')
        setLoadError(`Error al cargar ❌ — ${reason}. Se muestran datos locales de respaldo.`)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadRemoteState()

    return () => {
      cancelled = true
    }
  }, [])

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
  }, [])

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        ...derivedState,
        isLoading,
        loadError,
        dataSource,
        toast,
        clearToast,
        defaultPinStyle: normalizePinStyle(defaultPinStyle),
        restaurantPinStyleOverrides: normalizePinStyleOverrides(
          restaurantPinStyleOverrides,
        ),
        setDefaultPinStyle,
        setRestaurantPinStyle,
        clearRestaurantPinStyle,
        applyFilters,
        resetFilters,
        removeFilter,
        updateUser,
        createRestaurant,
        updateRestaurant,
        createGroup,
        updateGroup,
        createCategory,
        updateCategory,
        createDishType,
        updateDishType,
        createDishEntry,
        updateDishEntry,
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}

function hydrateStateFromData(rawData) {
  const dishEntries = rawData.dishEntries.map((entry) => ({
    ...entry,
    puntuacion_general:
      typeof entry.puntuacion_general === 'number'
        ? entry.puntuacion_general
        : calculateGeneralScore(entry),
  }))

  return {
    ...rawData,
    dishEntries,
    restaurants: enrichRestaurants(rawData.restaurants, dishEntries),
  }
}

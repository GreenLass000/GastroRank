import { useEffect, useState } from 'react'
import { createSeedData } from '../data/seed.js'
import { AppStateContext } from '../context/appStateContext.js'
import {
  createAchievement as createAchievementRequest,
  createCategory as createCategoryRequest,
  createComment as createCommentRequest,
  createDishEntry as createDishEntryRequest,
  createDishType as createDishTypeRequest,
  createFollow as createFollowRequest,
  createGroup as createGroupRequest,
  createInspirationList as createInspirationListRequest,
  createInspirationListItem as createInspirationListItemRequest,
  createReaction as createReactionRequest,
  createRecommendation as createRecommendationRequest,
  createRestaurant as createRestaurantRequest,
  deleteFollow as deleteFollowRequest,
  deleteReaction as deleteReactionRequest,
  fetchAchievements as fetchAchievementsRequest,
  fetchBootstrapData,
  fetchComments as fetchCommentsRequest,
  fetchFollows as fetchFollowsRequest,
  fetchInspirationLists as fetchInspirationListsRequest,
  fetchRecommendations as fetchRecommendationsRequest,
  updateCategory as updateCategoryRequest,
  updateDishEntry as updateDishEntryRequest,
  updateDishType as updateDishTypeRequest,
  updateGroup as updateGroupRequest,
  updateInspirationListItem as updateInspirationListItemRequest,
  updateRecommendation as updateRecommendationRequest,
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
import { DEFAULT_PIN_STYLE, PIN_STYLES, STORAGE_KEYS } from '../lib/constants.js'
import {
  calculateDistanceMeters,
  DEFAULT_MAP_CENTER,
  hasValidCoordinates,
} from '../lib/maps.js'
import { formatDistance } from '../lib/format.js'
import {
  buildCategoryRankings,
  buildDishTypeRankings,
  buildGlobalRankings,
  buildRestaurantRankings,
} from '../lib/ranking.js'
import { calculateAverageScore, calculateGeneralScore } from '../lib/scoring.js'
import { usePersistentState } from '../hooks/usePersistentState.js'

const USER_LEVELS = [
  { min: 0, label: 'Novato' },
  { min: 3, label: 'Foodie' },
  { min: 5, label: 'Gourmet' },
  { min: 7, label: 'Referente' },
  { min: 10, label: 'Leyenda' },
]

const ACHIEVEMENT_DEFINITIONS = [
  {
    badgeType: 'primer_plato',
    matches: ({ currentUserEntries }) => currentUserEntries.length >= 1,
  },
  {
    badgeType: 'cinco_platos',
    matches: ({ currentUserEntries }) => currentUserEntries.length >= 5,
  },
  {
    badgeType: 'diez_platos',
    matches: ({ currentUserEntries }) => currentUserEntries.length >= 10,
  },
  {
    badgeType: 'primer_restaurante',
    matches: ({ currentUserEntries }) =>
      new Set(currentUserEntries.map((entry) => entry.restaurant_id)).size >= 1,
  },
  {
    badgeType: 'cinco_restaurantes',
    matches: ({ currentUserEntries }) =>
      new Set(currentUserEntries.map((entry) => entry.restaurant_id)).size >= 5,
  },
  {
    badgeType: 'catador_social',
    matches: ({ currentUserEntries, reactions, currentUserId }) =>
      reactions.filter(
        (reaction) =>
          reaction.user_id !== currentUserId &&
          currentUserEntries.some((entry) => entry.id === reaction.dish_entry_id),
      ).length >= 10,
  },
  {
    badgeType: 'explorador',
    matches: ({ currentUserEntries }) =>
      new Set(currentUserEntries.map((entry) => entry.categoria_id)).size >= 5,
  },
  {
    badgeType: 'racha_semanal',
    matches: ({ weeklyStreak }) => weeklyStreak >= 3,
  },
  {
    badgeType: 'top_score',
    matches: ({ currentUserEntries }) =>
      currentUserEntries.some((entry) => Number(entry.puntuacion_general ?? 0) >= 9),
  },
  {
    badgeType: 'coleccionista_inspo',
    matches: ({ inspirationListItems, currentUserListIds }) =>
      inspirationListItems.filter((item) => currentUserListIds.has(item.list_id)).length >= 5,
  },
]

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
    follows: [],
    reactions: [],
    comments: [],
    inspirationLists: [],
    inspirationListItems: [],
    recommendations: [],
    achievements: [],
  }
}

function getUserLevel(achievementsCount) {
  return USER_LEVELS.reduce(
    (currentLevel, candidate) =>
      achievementsCount >= candidate.min ? candidate.label : currentLevel,
    USER_LEVELS[0].label,
  )
}

function flattenInspirationLists(inspirationLists) {
  const normalizedLists = inspirationLists.map((list) => ({
    ...list,
    is_default: Boolean(list.is_default),
    items: undefined,
  }))
  const items = inspirationLists.flatMap((list) =>
    (list.items ?? []).map((item) => ({
      ...item,
      tried: Boolean(item.tried),
      list_id: item.list_id ?? list.id,
    })),
  )

  return {
    inspirationLists: normalizedLists,
    inspirationListItems: items,
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
        categories,
        currentGroupId,
        currentUserId,
        dishTypes,
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

function buildHomeDishTypeSection({ categories, dishTypes, rankingEntries }) {
  const rankingEntriesByCategoryId = rankingEntries.reduce((acc, entry) => {
    acc[entry.categoryId] ??= []
    acc[entry.categoryId].push(entry)
    return acc
  }, {})
  const rankingEntriesByDishTypeId = rankingEntries.reduce((acc, entry) => {
    acc[entry.dishTypeId] ??= []
    acc[entry.dishTypeId].push(entry)
    return acc
  }, {})
  const availableCategoryIds = new Set(rankingEntries.map((entry) => entry.categoryId))
  const availableDishTypeIds = new Set(rankingEntries.map((entry) => entry.dishTypeId))
  const availableCategories = categories
    .filter((category) => availableCategoryIds.has(category.id))
    .map((category) => ({
      id: category.id,
      icon: category.icono,
      name: category.nombre,
      rankingCount: rankingEntriesByCategoryId[category.id]?.length ?? 0,
    }))
  const availableDishTypes = dishTypes
    .filter((dishType) => availableDishTypeIds.has(dishType.id))
    .map((dishType) => ({
      id: dishType.id,
      categoryId: dishType.categoria_id,
      name: dishType.nombre,
      alias: dishType.alias,
      rankingCount: rankingEntriesByDishTypeId[dishType.id]?.length ?? 0,
    }))
  const dishTypesByCategoryId = availableDishTypes.reduce((acc, dishType) => {
    acc[dishType.categoryId] ??= []
    acc[dishType.categoryId].push(dishType)
    return acc
  }, {})

  return {
    categories: availableCategories,
    dishTypes: availableDishTypes,
    dishTypesByCategoryId,
    rankings: rankingEntries,
    rankingsByCategoryId: rankingEntriesByCategoryId,
    rankingsByDishTypeId: rankingEntriesByDishTypeId,
  }
}

function buildHomeNearbySection({ origin, restaurants }) {
  const nearbyRestaurants = restaurants
    .filter((restaurant) => hasValidCoordinates(restaurant))
    .map((restaurant) => {
      const distanceMeters = calculateDistanceMeters(origin, restaurant)

      return {
        ...restaurant,
        distanceMeters,
        distanceLabel: formatDistance(distanceMeters),
      }
    })
    .sort(
      (left, right) =>
        left.distanceMeters - right.distanceMeters ||
        right.restaurant_score - left.restaurant_score,
    )

  return {
    origin: {
      lat: Number(origin.lat),
      lng: Number(origin.lng),
      source: origin.source,
    },
    originLabel:
      origin.source === 'geolocation' ? 'Tu ubicación actual' : 'Valladolid',
    restaurants: nearbyRestaurants,
  }
}

function buildDerivedState(state, filters, filterOrigin) {
  const currentUser = state.users[0]
  const follows = state.follows ?? []
  const reactions = state.reactions ?? []
  const comments = state.comments ?? []
  const inspirationLists = state.inspirationLists ?? []
  const inspirationListItems = state.inspirationListItems ?? []
  const recommendations = state.recommendations ?? []
  const achievements = state.achievements ?? []
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
  const following = follows.filter(
    (follow) => follow.follower_user_id === currentUser.id,
  )
  const followers = follows.filter(
    (follow) => follow.followed_user_id === currentUser.id,
  )
  const followingIds = new Set(following.map((follow) => follow.followed_user_id))
  const followerIds = new Set(followers.map((follow) => follow.follower_user_id))
  const mutualFollowIds = Array.from(followingIds).filter((userId) =>
    followerIds.has(userId),
  )
  const mutualFollows = state.users.filter((user) => mutualFollowIds.includes(user.id))
  const currentUserAchievements = achievements.filter(
    (achievement) => achievement.user_id === currentUser.id,
  )
  const currentUserRecommendations = recommendations.filter(
    (recommendation) => recommendation.to_user_id === currentUser.id,
  )
  const currentUserInspirationLists = inspirationLists
    .filter((list) => list.user_id === currentUser.id)
    .map((list) => ({
      ...list,
      items: inspirationListItems.filter((item) => item.list_id === list.id),
    }))
  const weeklyStreak = (() => {
    const entryWeeks = new Set(
      currentUserEntries.map((entry) => {
        const source = new Date(entry.created_at ?? entry.fecha)
        const normalized = new Date(
          Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()),
        )
        const day = normalized.getUTCDay() || 7
        normalized.setUTCDate(normalized.getUTCDate() - day + 1)
        normalized.setUTCHours(0, 0, 0, 0)
        return normalized.toISOString()
      }),
    )
    let streak = 0
    const cursor = new Date()
    cursor.setUTCHours(0, 0, 0, 0)
    const currentDay = cursor.getUTCDay() || 7
    cursor.setUTCDate(cursor.getUTCDate() - currentDay + 1)

    while (entryWeeks.has(cursor.toISOString())) {
      streak += 1
      cursor.setUTCDate(cursor.getUTCDate() - 7)
    }

    return streak
  })()
  const userLevel = getUserLevel(currentUserAchievements.length)
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
  const homeDishTypeSection = buildHomeDishTypeSection({
    categories: state.categories,
    dishTypes: state.dishTypes,
    rankingEntries: rankingContexts.private.dishType,
  })
  const homeNearbySection = buildHomeNearbySection({
    origin: filterOrigin,
    restaurants: state.restaurants,
  })

  return {
    currentUser,
    currentGroup,
    currentUserEntries,
    follows,
    reactions,
    comments,
    inspirationLists: currentUserInspirationLists,
    inspirationListItems,
    achievements: currentUserAchievements,
    recommendations: currentUserRecommendations,
    mutualFollows,
    weeklyStreak,
    userLevel,
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
    homeDishTypeSection,
    homeNearbySection,
    restaurantsByScore,
  }
}

function normalizePinStyle(style) {
  if (style === 'Score') {
    return DEFAULT_PIN_STYLE
  }

  return PIN_STYLES.includes(style) ? style : DEFAULT_PIN_STYLE
}

function normalizePinStyleOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(overrides)
      .map(([restaurantId, style]) => [restaurantId, normalizePinStyle(style)])
      .filter(([, style]) => PIN_STYLES.includes(style)),
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
    DEFAULT_PIN_STYLE,
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

  async function loadFollows(userId = derivedState.currentUser.id) {
    const response = await fetchFollowsRequest({ userId })

    if (!response?.follows) {
      throw new Error('La API no devolvió los follows.')
    }

    setState((current) => ({
      ...current,
      follows: response.follows,
    }))

    return response
  }

  async function followUser(followedUserId) {
    const response = await createFollowRequest({
      follower_user_id: derivedState.currentUser.id,
      followed_user_id: followedUserId,
    })

    if (!response?.follow) {
      throw new Error('La API no devolvió el follow creado.')
    }

    setState((current) => ({
      ...current,
      follows: [
        ...current.follows.filter(
          (follow) =>
            !(
              follow.follower_user_id === response.follow.follower_user_id &&
              follow.followed_user_id === response.follow.followed_user_id
            ),
        ),
        response.follow,
      ],
    }))

    return response
  }

  async function unfollowUser(followedUserId) {
    await deleteFollowRequest(followedUserId, {
      userId: derivedState.currentUser.id,
    })

    setState((current) => ({
      ...current,
      follows: current.follows.filter(
        (follow) =>
          !(
            follow.follower_user_id === derivedState.currentUser.id &&
            follow.followed_user_id === followedUserId
          ),
      ),
    }))
  }

  function getMutualFollows() {
    return derivedState.mutualFollows
  }

  async function loadComments(entryId) {
    const response = await fetchCommentsRequest(entryId)

    if (!response?.comments) {
      throw new Error('La API no devolvió los comentarios.')
    }

    setState((current) => ({
      ...current,
      comments: [
        ...current.comments.filter((comment) => comment.dish_entry_id !== entryId),
        ...response.comments,
      ],
    }))

    return response
  }

  async function addComment(payload) {
    const response = await createCommentRequest(payload)

    if (!response?.comment) {
      throw new Error('La API no devolvió el comentario creado.')
    }

    setState((current) => ({
      ...current,
      comments: [...current.comments, response.comment],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function addReaction(payload) {
    const response = await createReactionRequest(payload)

    if (!response?.reaction) {
      throw new Error('La API no devolvió la reacción.')
    }

    setState((current) => ({
      ...current,
      reactions: [
        ...current.reactions.filter(
          (reaction) =>
            !(
              reaction.dish_entry_id === response.reaction.dish_entry_id &&
              reaction.user_id === response.reaction.user_id
            ),
        ),
        response.reaction,
      ],
    }))

    return response
  }

  async function removeReaction(reactionId) {
    await deleteReactionRequest(reactionId)

    setState((current) => ({
      ...current,
      reactions: current.reactions.filter((reaction) => reaction.id !== reactionId),
    }))
  }

  async function loadInspirationLists(userId = derivedState.currentUser.id) {
    const response = await fetchInspirationListsRequest({ userId })

    if (!response?.inspirationLists) {
      throw new Error('La API no devolvió las listas de inspiración.')
    }

    const flattened = flattenInspirationLists(response.inspirationLists)

    setState((current) => ({
      ...current,
      inspirationLists: flattened.inspirationLists,
      inspirationListItems: flattened.inspirationListItems,
    }))

    return response
  }

  async function createInspirationList(payload) {
    const response = await createInspirationListRequest(payload)

    if (!response?.inspirationList) {
      throw new Error('La API no devolvió la lista creada.')
    }

    setState((current) => ({
      ...current,
      inspirationLists: [...current.inspirationLists, response.inspirationList],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function saveToList(payload) {
    const response = await createInspirationListItemRequest(payload)

    if (!response?.inspirationListItem) {
      throw new Error('La API no devolvió el guardado en lista.')
    }

    setState((current) => ({
      ...current,
      inspirationListItems: [
        ...current.inspirationListItems.filter(
          (item) => item.id !== response.inspirationListItem.id,
        ),
        response.inspirationListItem,
      ],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function markTried(itemId, tried = true) {
    const response = await updateInspirationListItemRequest(itemId, { tried })

    if (!response?.inspirationListItem) {
      throw new Error('La API no devolvió el elemento actualizado.')
    }

    setState((current) => ({
      ...current,
      inspirationListItems: replaceRecordById(
        current.inspirationListItems,
        response.inspirationListItem,
      ),
    }))

    return response
  }

  async function removeFromList(itemId) {
    const response = await updateInspirationListItemRequest(itemId, { remove: true })

    if (!response?.inspirationListItem?.removed) {
      throw new Error('La API no confirmó la eliminación del elemento.')
    }

    setState((current) => ({
      ...current,
      inspirationListItems: current.inspirationListItems.filter((item) => item.id !== itemId),
    }))

    return response
  }

  async function loadRecommendations(userId = derivedState.currentUser.id) {
    const response = await fetchRecommendationsRequest({ userId })

    if (!response?.recommendations) {
      throw new Error('La API no devolvió las recomendaciones.')
    }

    setState((current) => ({
      ...current,
      recommendations: response.recommendations,
    }))

    return response
  }

  async function sendRecommendation(payload) {
    const response = await createRecommendationRequest(payload)

    if (!response?.recommendation) {
      throw new Error('La API no devolvió la recomendación creada.')
    }

    setState((current) => ({
      ...current,
      recommendations: [...current.recommendations, response.recommendation],
    }))

    return response
  }

  async function markRecommendationSeen(recommendationId) {
    const response = await updateRecommendationRequest(recommendationId, { seen: true })

    if (!response?.recommendation) {
      throw new Error('La API no devolvió la recomendación actualizada.')
    }

    setState((current) => ({
      ...current,
      recommendations: replaceRecordById(
        current.recommendations,
        response.recommendation,
      ),
    }))

    return response
  }

  async function loadAchievements(userId = derivedState.currentUser.id) {
    const response = await fetchAchievementsRequest({ userId })

    if (!response?.achievements) {
      throw new Error('La API no devolvió los logros.')
    }

    setState((current) => ({
      ...current,
      achievements: [
        ...current.achievements.filter((achievement) => achievement.user_id !== userId),
        ...response.achievements,
      ],
    }))

    return response
  }

  async function checkAndUnlockAchievements(nextState = state) {
    const currentUserId = derivedState.currentUser.id
    const currentUserEntries = nextState.dishEntries.filter(
      (entry) => entry.created_by_user_id === currentUserId,
    )
    const currentUserListIds = new Set(
      (nextState.inspirationLists ?? [])
        .filter((list) => list.user_id === currentUserId)
        .map((list) => list.id),
    )
    const evaluationInput = {
      currentUserId,
      currentUserEntries,
      reactions: nextState.reactions ?? [],
      weeklyStreak: buildDerivedState(nextState, activeFilters, filterOrigin).weeklyStreak,
      inspirationListItems: nextState.inspirationListItems ?? [],
      currentUserListIds,
    }
    const unlockedBadgeTypes = new Set(
      (nextState.achievements ?? [])
        .filter((achievement) => achievement.user_id === currentUserId)
        .map((achievement) => achievement.badge_type),
    )
    const pendingDefinitions = ACHIEVEMENT_DEFINITIONS.filter(
      (definition) =>
        !unlockedBadgeTypes.has(definition.badgeType) &&
        definition.matches(evaluationInput),
    )

    if (pendingDefinitions.length === 0) {
      return []
    }

    const createdAchievements = []

    for (const definition of pendingDefinitions) {
      const response = await createAchievementRequest({
        user_id: currentUserId,
        badge_type: definition.badgeType,
        notified: false,
      })

      if (response?.achievement) {
        createdAchievements.push(response.achievement)
      }
    }

    if (createdAchievements.length > 0) {
      setState((current) => ({
        ...current,
        achievements: [...current.achievements, ...createdAchievements],
      }))
    }

    return createdAchievements
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
    let nextStateSnapshot = null

    setState((current) => {
      const nextDishEntries = [...current.dishEntries, createdEntry]
      nextStateSnapshot = {
        ...current,
        dishEntries: nextDishEntries,
        restaurants: updateRestaurantsFromEntries(
          current.restaurants,
          nextDishEntries,
        ),
      }

      return nextStateSnapshot
    })
    await checkAndUnlockAchievements(nextStateSnapshot ?? state)
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
        loadFollows,
        followUser,
        unfollowUser,
        getMutualFollows,
        loadComments,
        addComment,
        addReaction,
        removeReaction,
        loadInspirationLists,
        createInspirationList,
        saveToList,
        markTried,
        removeFromList,
        loadRecommendations,
        sendRecommendation,
        markRecommendationSeen,
        loadAchievements,
        checkAndUnlockAchievements,
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
  const dishEntries = (rawData.dishEntries ?? []).map((entry) => ({
    ...entry,
    puntuacion_general:
      typeof entry.puntuacion_general === 'number'
        ? entry.puntuacion_general
        : calculateGeneralScore(entry),
  }))
  const flattened = flattenInspirationLists(rawData.inspirationLists ?? [])

  return {
    ...rawData,
    dishEntries,
    restaurants: enrichRestaurants(rawData.restaurants ?? [], dishEntries),
    follows: rawData.follows ?? [],
    reactions: rawData.reactions ?? [],
    comments: (rawData.comments ?? []).map((comment) => ({
      ...comment,
      mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
    })),
    inspirationLists: flattened.inspirationLists,
    inspirationListItems:
      rawData.inspirationListItems?.map((item) => ({
        ...item,
        tried: Boolean(item.tried),
      })) ?? flattened.inspirationListItems,
    recommendations:
      rawData.recommendations?.map((recommendation) => ({
        ...recommendation,
        seen: Boolean(recommendation.seen),
      })) ?? [],
    achievements:
      rawData.achievements?.map((achievement) => ({
        ...achievement,
        notified: Boolean(achievement.notified),
      })) ?? [],
  }
}

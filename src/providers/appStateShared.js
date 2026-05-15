import { getAchievementTitle } from '../lib/achievements.js'
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

const USER_LEVELS = [
  { min: 0, label: 'Novato' },
  { min: 3, label: 'Foodie' },
  { min: 5, label: 'Gourmet' },
  { min: 7, label: 'Referente' },
  { min: 10, label: 'Leyenda' },
]

export const ACHIEVEMENT_DEFINITIONS = [
  {
    badgeType: 'croquetero',
    matches: ({ sameDishTypeMaxCount }) => sameDishTypeMaxCount >= 5,
  },
  {
    badgeType: 'exploradora',
    matches: ({ distinctRestaurantsCount }) => distinctRestaurantsCount >= 10,
  },
  {
    badgeType: 'foodie_visual',
    matches: ({ entriesWithPhotoCount }) => entriesWithPhotoCount >= 10,
  },
  {
    badgeType: 'sin_fronteras',
    matches: ({ distinctCitiesCount }) => distinctCitiesCount >= 3,
  },
  {
    badgeType: 'referente',
    matches: ({ communityTopTenEntriesCount }) => communityTopTenEntriesCount >= 3,
  },
  {
    badgeType: 'exigente',
    matches: ({ fullyScoredEntriesCount }) => fullyScoredEntriesCount >= 20,
  },
  {
    badgeType: 'habitual',
    matches: ({ sameRestaurantMaxCount }) => sameRestaurantMaxCount >= 5,
  },
  {
    badgeType: 'omnivoro',
    matches: ({ distinctCategoriesCount }) => distinctCategoriesCount >= 5,
  },
  {
    badgeType: 'social',
    matches: ({ reactionsFromOthersCount }) => reactionsFromOthersCount >= 10,
  },
  {
    badgeType: 'top_chef',
    matches: ({ categoryWinsCount }) => categoryWinsCount >= 1,
  },
]

export function parseCityFromAddress(address) {
  const parts = String(address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts[parts.length - 1] || ''
}

export function getMaxCountBy(items) {
  const counts = items.reduce((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})

  const topCount = Object.values(counts).sort((left, right) => right - left)[0]
  return Number(topCount ?? 0)
}

export function hasAllSubscores(entry) {
  return ['sabor', 'textura', 'presentacion', 'calidad_precio'].every(
    (field) => typeof entry[field] === 'number',
  )
}

export function getTopEntryByCategory(entries) {
  return Object.values(
    entries.reduce((acc, entry) => {
      acc[entry.categoria_id] ??= []
      acc[entry.categoria_id].push(entry)
      return acc
    }, {}),
  ).map((categoryEntries) =>
    [...categoryEntries].sort((left, right) => {
      if (right.puntuacion_general !== left.puntuacion_general) {
        return right.puntuacion_general - left.puntuacion_general
      }

      return new Date(right.created_at) - new Date(left.created_at)
    })[0],
  )
}

export function createEmptyAppData() {
  return {
    users: [],
    groups: [],
    groupMembers: [],
    restaurants: [],
    categories: [],
    dishTypes: [],
    dishEntries: [],
    publicShareTokens: [],
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

export function flattenInspirationLists(inspirationLists) {
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

export function enrichRestaurants(restaurants, dishEntries) {
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

export function replaceRecordById(items, nextRecord) {
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
        categories,
        currentGroupId,
        currentUserId,
        dishTypes,
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

export function buildDerivedState(state, filters, filterOrigin, sessionUser = null) {
  const baseCurrentUser = sessionUser?.id
    ? state.users.find((user) => user.id === sessionUser.id) ?? null
    : state.users[0] ?? null
  const currentUser =
    baseCurrentUser || sessionUser
      ? {
          ...(baseCurrentUser ?? {}),
          ...(sessionUser ?? {}),
        }
      : null

  if (!currentUser) {
    return {
      currentUser: null,
      currentGroup: null,
      currentUserEntries: [],
      follows: [],
      reactions: [],
      comments: [],
      inspirationLists: [],
      inspirationListItems: [],
      achievements: [],
      recommendations: [],
      mutualFollows: [],
      weeklyStreak: 0,
      userLevel: null,
      groupsForCurrentUser: [],
      pendingGroupsForCurrentUser: [],
      latestEntries: [],
      rankingContexts: {
        private: { dishType: [], category: [], restaurant: [], global: [] },
        group: { dishType: [], category: [], restaurant: [], global: [] },
        public: { dishType: [], category: [], restaurant: [], global: [] },
      },
      filteredDishEntries: [],
      filteredLatestEntries: [],
      filteredRankingContexts: {
        private: { dishType: [], category: [], restaurant: [], global: [] },
        group: { dishType: [], category: [], restaurant: [], global: [] },
        public: { dishType: [], category: [], restaurant: [], global: [] },
      },
      filteredRestaurantsByScore: [],
      activeFilters: normalizeFilters(filters, state.dishTypes),
      activeFilterChips: [],
      availableFilterOptions: buildAvailableFilterOptions({
        categories: state.categories,
        dishTypes: state.dishTypes,
        entries: [],
        users: [],
      }),
      filtersCount: 0,
      hasActiveFilters: false,
      filterOrigin,
      filterOriginLabel:
        filterOrigin.source === 'geolocation' ? 'tu ubicación actual' : 'Valladolid',
      profileStats: { totalPlatos: 0, totalRestaurantes: 0, grupos: 0 },
      homeDishTypeSection: {
        categories: [],
        dishTypes: [],
        dishTypesByCategoryId: {},
        rankings: [],
        rankingsByCategoryId: {},
        rankingsByDishTypeId: {},
      },
      homeNearbySection: {
        origin: { lat: filterOrigin.lat, lng: filterOrigin.lng, source: filterOrigin.source },
        originLabel:
          filterOrigin.source === 'geolocation' ? 'Tu ubicación actual' : 'Valladolid',
        restaurants: [],
      },
      restaurantsByScore: [],
    }
  }

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
  const pendingGroupsForCurrentUser = state.groups.filter((group) =>
    state.groupMembers.some(
      (member) =>
        member.group_id === group.id &&
        member.user_id === currentUser.id &&
        member.status === 'pending',
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
    pendingGroupsForCurrentUser,
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

export function readStoredAuthToken() {
  return window.localStorage.getItem(STORAGE_KEYS.authToken) ?? ''
}

export function storeAuthToken(token) {
  if (!token) {
    window.localStorage.removeItem(STORAGE_KEYS.authToken)
    return
  }

  window.localStorage.setItem(STORAGE_KEYS.authToken, token)
}

export function normalizePinStyleOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(overrides)
      .map(([restaurantId, style]) => [restaurantId, normalizePinStyle(style)])
      .filter(([, style]) => PIN_STYLES.includes(style)),
  )
}

export function sanitizePinStyle(style) {
  return normalizePinStyle(style)
}

export function getAchievementNotificationMessage(badgeType) {
  return `🎉 Logro desbloqueado: ${getAchievementTitle(badgeType)}`
}

export function hydrateStateFromData(rawData) {
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
    users:
      rawData.users?.map((user) => ({
        ...user,
        bio: user.bio ?? '',
        avatar_url: user.avatar_url ?? '',
      })) ?? [],
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

export { DEFAULT_FILTERS, DEFAULT_MAP_CENTER }

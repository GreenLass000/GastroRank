import { calculateAverageScore } from './scoring.js'

export function filterEntriesByContext(entries, contextId, currentUserId, currentGroupId) {
  if (contextId === 'private') {
    return entries.filter((entry) => entry.created_by_user_id === currentUserId)
  }

  if (contextId === 'group') {
    return entries.filter((entry) => entry.group_id === currentGroupId)
  }

  return entries.filter((entry) => entry.visibility === 'public')
}

function createLookup(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

function getBestPhoto(entries) {
  const entryWithPhoto = [...entries]
    .filter((entry) => entry.foto_url)
    .sort((a, b) => b.puntuacion_general - a.puntuacion_general)[0]

  return entryWithPhoto?.foto_url ?? null
}

export function buildDishTypeRankings({
  categories,
  currentGroupId,
  currentUserId,
  dishTypes,
  entries,
  restaurants,
  contextId,
}) {
  const filteredEntries = filterEntriesByContext(
    entries,
    contextId,
    currentUserId,
    currentGroupId,
  )
  const globalEntriesByDishType = entries.reduce((acc, entry) => {
    acc[entry.tipo_plato_id] ??= []
    acc[entry.tipo_plato_id].push(entry)
    return acc
  }, {})
  const restaurantLookup = createLookup(restaurants)
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const key = `${entry.restaurant_id}:${entry.tipo_plato_id}`
    acc[key] ??= []
    acc[key].push(entry)
    return acc
  }, {})

  return Object.values(groupedEntries)
    .map((group) => {
      const sample = group[0]
      const mediaEntry = calculateAverageScore(group)
      const mediaGlobal = calculateAverageScore(
        globalEntriesByDishType[sample.tipo_plato_id] ?? [],
      )
      const votos = group.length
      const score = Number(
        (((mediaEntry * votos) + (mediaGlobal * 5)) / (votos + 5)).toFixed(1),
      )

      return {
        id: `${sample.restaurant_id}:${sample.tipo_plato_id}`,
        restaurantId: sample.restaurant_id,
        restaurantName: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        categoryId: sample.categoria_id,
        categoryName: categoryLookup[sample.categoria_id]?.nombre ?? 'Categoría',
        categoryIcon: categoryLookup[sample.categoria_id]?.icono ?? '🍽️',
        dishTypeId: sample.tipo_plato_id,
        dishTypeName: dishTypeLookup[sample.tipo_plato_id]?.nombre ?? 'Plato',
        mediaEntry,
        mediaGlobal,
        score,
        votos,
        bestPhotoUrl: getBestPhoto(group),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.votos !== left.votos) {
        return right.votos - left.votos
      }

      return right.mediaEntry - left.mediaEntry
    })
}

export function buildCategoryRankings({
  categories,
  currentGroupId,
  currentUserId,
  entries,
  restaurants,
  contextId,
}) {
  const filteredEntries = filterEntriesByContext(
    entries,
    contextId,
    currentUserId,
    currentGroupId,
  )
  const categoryLookup = createLookup(categories)
  const restaurantLookup = createLookup(restaurants)
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const key = `${entry.restaurant_id}:${entry.categoria_id}`
    acc[key] ??= []
    acc[key].push(entry)
    return acc
  }, {})

  return Object.values(groupedEntries)
    .map((group) => {
      const sample = group[0]
      const mediaCategoria = calculateAverageScore(group)

      return {
        id: `${sample.restaurant_id}:${sample.categoria_id}`,
        restaurantId: sample.restaurant_id,
        restaurantName: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        categoryId: sample.categoria_id,
        categoryName: categoryLookup[sample.categoria_id]?.nombre ?? 'Categoría',
        categoryIcon: categoryLookup[sample.categoria_id]?.icono ?? '🍽️',
        score: mediaCategoria,
        votos: group.length,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.votos - left.votos
    })
}

export function buildRestaurantRankings({
  currentGroupId,
  currentUserId,
  entries,
  restaurants,
  contextId,
}) {
  const filteredEntries = filterEntriesByContext(
    entries,
    contextId,
    currentUserId,
    currentGroupId,
  )
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    acc[entry.restaurant_id] ??= []
    acc[entry.restaurant_id].push(entry)
    return acc
  }, {})

  return Object.entries(groupedEntries)
    .map(([restaurantId, group]) => ({
      id: restaurantId,
      restaurantId,
      restaurantName:
        restaurants.find((restaurant) => restaurant.id === restaurantId)?.nombre ??
        'Restaurante',
      score: calculateAverageScore(group),
      votos: group.length,
      bestPhotoUrl: getBestPhoto(group),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.votos - left.votos
    })
}

export function buildGlobalRankings({
  currentGroupId,
  currentUserId,
  entries,
  restaurants,
  contextId,
}) {
  const filteredEntries = filterEntriesByContext(
    entries,
    contextId,
    currentUserId,
    currentGroupId,
  )
  const restaurantLookup = createLookup(restaurants)

  return [...filteredEntries]
    .sort((left, right) => right.puntuacion_general - left.puntuacion_general)
    .map((entry) => ({
      id: entry.id,
      restaurantId: entry.restaurant_id,
      restaurantName: restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante',
      dishName: entry.nombre_plato,
      score: entry.puntuacion_general,
      votos: 1,
      bestPhotoUrl: entry.foto_url,
    }))
}

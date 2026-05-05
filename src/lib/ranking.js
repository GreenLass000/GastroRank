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

function createLookup(items = []) {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

function roundScore(score) {
  return typeof score === 'number' ? Number(score.toFixed(1)) : 0
}

function sortRankings(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  if (right.votos !== left.votos) {
    return right.votos - left.votos
  }

  return String(left.primaryLabel ?? left.restaurantName ?? left.categoryName ?? '')
    .localeCompare(
      String(right.primaryLabel ?? right.restaurantName ?? right.categoryName ?? ''),
      'es',
    )
}

function getBestPhoto(entries) {
  const entryWithPhoto = [...entries]
    .filter((entry) => entry.foto_url)
    .sort((left, right) => right.puntuacion_general - left.puntuacion_general)[0]

  return entryWithPhoto?.foto_url ?? null
}

function getDishTypeLabel(dishType, fallbackName) {
  return dishType?.nombre ?? fallbackName ?? 'Plato'
}

function buildSimpleRestaurantRankings({
  categories,
  dishTypes,
  entries,
  restaurants,
}) {
  const restaurantLookup = createLookup(restaurants)
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)
  const groupedEntries = entries.reduce((acc, entry) => {
    acc[entry.restaurant_id] ??= []
    acc[entry.restaurant_id].push(entry)
    return acc
  }, {})

  return Object.entries(groupedEntries)
    .map(([restaurantId, group]) => {
      const sample = group[0]
      const category = categoryLookup[sample.categoria_id]
      const dishType = dishTypeLookup[sample.tipo_plato_id]

      return {
        id: restaurantId,
        restaurantId,
        restaurantName:
          restaurantLookup[restaurantId]?.nombre ?? 'Restaurante',
        categoryId: sample.categoria_id,
        categoryName: category?.nombre ?? 'Categoría',
        categoryIcon: category?.icono ?? '🍽️',
        dishTypeId: sample.tipo_plato_id,
        dishTypeName: getDishTypeLabel(dishType, sample.nombre_plato),
        score: roundScore(calculateAverageScore(group)),
        votos: group.length,
        bestPhotoUrl: getBestPhoto(group),
        primaryLabel: restaurantLookup[restaurantId]?.nombre ?? 'Restaurante',
      }
    })
    .sort(sortRankings)
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

      return {
        id: `${sample.restaurant_id}:${sample.tipo_plato_id}`,
        restaurantId: sample.restaurant_id,
        restaurantName: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        categoryId: sample.categoria_id,
        categoryName: categoryLookup[sample.categoria_id]?.nombre ?? 'Categoría',
        categoryIcon: categoryLookup[sample.categoria_id]?.icono ?? '🍽️',
        dishTypeId: sample.tipo_plato_id,
        dishTypeName: getDishTypeLabel(
          dishTypeLookup[sample.tipo_plato_id],
          sample.nombre_plato,
        ),
        score: roundScore(calculateAverageScore(group)),
        votos: group.length,
        bestPhotoUrl: getBestPhoto(group),
        primaryLabel: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        secondaryLabel:
          dishTypeLookup[sample.tipo_plato_id]?.nombre ??
          categoryLookup[sample.categoria_id]?.nombre ??
          'Plato',
      }
    })
    .sort(sortRankings)
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

      return {
        id: `${sample.restaurant_id}:${sample.categoria_id}`,
        restaurantId: sample.restaurant_id,
        restaurantName: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        categoryId: sample.categoria_id,
        categoryName: categoryLookup[sample.categoria_id]?.nombre ?? 'Categoría',
        categoryIcon: categoryLookup[sample.categoria_id]?.icono ?? '🍽️',
        score: roundScore(calculateAverageScore(group)),
        votos: group.length,
        primaryLabel: restaurantLookup[sample.restaurant_id]?.nombre ?? 'Restaurante',
        secondaryLabel: categoryLookup[sample.categoria_id]?.nombre ?? 'Categoría',
      }
    })
    .sort(sortRankings)
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

  return buildSimpleRestaurantRankings({
    categories: [],
    dishTypes: [],
    entries: filteredEntries,
    restaurants,
  })
}

export function buildGlobalRankings({
  categories = [],
  currentGroupId,
  currentUserId,
  dishTypes = [],
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
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)

  return [...filteredEntries]
    .sort((left, right) => {
      if (right.puntuacion_general !== left.puntuacion_general) {
        return right.puntuacion_general - left.puntuacion_general
      }

      return new Date(right.created_at) - new Date(left.created_at)
    })
    .map((entry) => ({
      id: entry.id,
      restaurantId: entry.restaurant_id,
      restaurantName: restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante',
      categoryId: entry.categoria_id,
      categoryName: categoryLookup[entry.categoria_id]?.nombre ?? 'Categoría',
      categoryIcon: categoryLookup[entry.categoria_id]?.icono ?? '🍽️',
      dishTypeId: entry.tipo_plato_id,
      dishTypeName: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      dishName: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      score: entry.puntuacion_general,
      votos: 1,
      bestPhotoUrl: entry.foto_url,
      primaryLabel: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      secondaryLabel:
        restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante',
    }))
}

export function buildCategoryFilteredRestaurantRankings({
  categories,
  dishTypes,
  entries,
  restaurants,
  categoryId,
  dishTypeId = '',
}) {
  if (!categoryId) {
    return []
  }

  const filteredEntries = entries.filter(
    (entry) =>
      entry.categoria_id === categoryId &&
      (!dishTypeId || entry.tipo_plato_id === dishTypeId),
  )
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)
  const category = categoryLookup[categoryId]
  const dishType = dishTypeId ? dishTypeLookup[dishTypeId] : null

  return buildSimpleRestaurantRankings({
    categories,
    dishTypes,
    entries: filteredEntries,
    restaurants,
  }).map((item) => ({
    ...item,
    categoryId,
    categoryName: category?.nombre ?? item.categoryName,
    categoryIcon: category?.icono ?? item.categoryIcon,
    dishTypeId: dishTypeId || item.dishTypeId,
    dishTypeName:
      dishTypeId && dishType ? getDishTypeLabel(dishType, item.dishTypeName) : item.dishTypeName,
    secondaryLabel: dishType
      ? `${category?.icono ?? '🍽️'} ${dishType.nombre}`
      : `${category?.icono ?? '🍽️'} ${category?.nombre ?? 'Categoría'}`,
    countLabel: `${item.votos} valoraciones`,
  }))
}

export function buildDishTypeFilteredRestaurantRankings({
  categories,
  dishTypes,
  entries,
  restaurants,
  dishTypeId,
}) {
  if (!dishTypeId) {
    return []
  }

  const dishTypeLookup = createLookup(dishTypes)
  const categoryLookup = createLookup(categories)
  const dishType = dishTypeLookup[dishTypeId]
  const category = dishType ? categoryLookup[dishType.categoria_id] : null
  const filteredEntries = entries.filter((entry) => entry.tipo_plato_id === dishTypeId)

  return buildSimpleRestaurantRankings({
    categories,
    dishTypes,
    entries: filteredEntries,
    restaurants,
  }).map((item) => ({
    ...item,
    dishTypeId,
    dishTypeName: getDishTypeLabel(dishType, item.dishTypeName),
    categoryId: dishType?.categoria_id ?? item.categoryId,
    categoryName: category?.nombre ?? item.categoryName,
    categoryIcon: category?.icono ?? item.categoryIcon,
    secondaryLabel: `${category?.icono ?? '🍽️'} ${getDishTypeLabel(dishType, item.dishTypeName)}`,
    countLabel: `${item.votos} valoraciones`,
  }))
}

export function buildGlobalDishEntryRankings({
  categories,
  dishTypes,
  entries,
  restaurants,
}) {
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)
  const restaurantLookup = createLookup(restaurants)

  return [...entries]
    .sort((left, right) => {
      if (right.puntuacion_general !== left.puntuacion_general) {
        return right.puntuacion_general - left.puntuacion_general
      }

      return new Date(right.created_at) - new Date(left.created_at)
    })
    .map((entry) => ({
      id: entry.id,
      restaurantId: entry.restaurant_id,
      restaurantName: restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante',
      categoryId: entry.categoria_id,
      categoryName: categoryLookup[entry.categoria_id]?.nombre ?? 'Categoría',
      categoryIcon: categoryLookup[entry.categoria_id]?.icono ?? '🍽️',
      dishTypeId: entry.tipo_plato_id,
      dishTypeName: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      dishName: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      score: entry.puntuacion_general,
      votos: 1,
      primaryLabel: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      secondaryLabel: `${restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante'} · ${categoryLookup[entry.categoria_id]?.icono ?? '🍽️'} ${categoryLookup[entry.categoria_id]?.nombre ?? 'Categoría'}`,
      countLabel: 'Entrada',
    }))
}

export function buildGlobalCategoryRankings({
  categories,
  entries,
}) {
  const categoryLookup = createLookup(categories)
  const groupedEntries = entries.reduce((acc, entry) => {
    acc[entry.categoria_id] ??= []
    acc[entry.categoria_id].push(entry)
    return acc
  }, {})

  return Object.entries(groupedEntries)
    .map(([categoryId, group]) => {
      const category = categoryLookup[categoryId]

      return {
        id: categoryId,
        categoryId,
        categoryName: category?.nombre ?? 'Categoría',
        categoryIcon: category?.icono ?? '🍽️',
        score: roundScore(calculateAverageScore(group)),
        votos: group.length,
        primaryLabel: `${category?.icono ?? '🍽️'} ${category?.nombre ?? 'Categoría'}`,
        secondaryLabel: 'Promedio global de la categoría',
        countLabel: `${group.length} platos`,
      }
    })
    .sort(sortRankings)
}

export function buildGlobalRestaurantRankings({
  entries,
  restaurants,
}) {
  if (entries.length === 0) {
    return []
  }

  const restaurantLookup = createLookup(restaurants)
  const groupedEntries = entries.reduce((acc, entry) => {
    acc[entry.restaurant_id] ??= []
    acc[entry.restaurant_id].push(entry)
    return acc
  }, {})
  const globalAvg = calculateAverageScore(entries) ?? 0
  const counts = Object.values(groupedEntries).map((group) => group.length)
  const maxN = Math.max(...counts, 1)
  const denominator = Math.log(maxN + 1) || 1

  return Object.entries(groupedEntries)
    .map(([restaurantId, group]) => {
      const n = group.length
      const sumScores = group.reduce(
        (sum, entry) => sum + (entry.puntuacion_general ?? 0),
        0,
      )
      const weightedAvg = (sumScores + (globalAvg * 5)) / (n + 5)

      return {
        id: restaurantId,
        restaurantId,
        restaurantName:
          restaurantLookup[restaurantId]?.nombre ?? 'Restaurante',
        score: roundScore((weightedAvg * Math.log(n + 1)) / denominator),
        votos: n,
        weightedAvg: roundScore(weightedAvg),
        primaryLabel: restaurantLookup[restaurantId]?.nombre ?? 'Restaurante',
        secondaryLabel: 'Score global ajustado por volumen',
        countLabel: `${n} platos`,
        bestPhotoUrl: getBestPhoto(group),
      }
    })
    .sort(sortRankings)
}

export function buildRankingDetailEntries({
  categories,
  dishTypes,
  entries,
  restaurants,
  users,
}) {
  const categoryLookup = createLookup(categories)
  const dishTypeLookup = createLookup(dishTypes)
  const restaurantLookup = createLookup(restaurants)
  const userLookup = createLookup(users)

  return [...entries]
    .sort((left, right) => {
      if (right.puntuacion_general !== left.puntuacion_general) {
        return right.puntuacion_general - left.puntuacion_general
      }

      return new Date(right.created_at) - new Date(left.created_at)
    })
    .map((entry) => ({
      ...entry,
      authorName: userLookup[entry.created_by_user_id]?.nombre ?? 'Usuario',
      categoryName: categoryLookup[entry.categoria_id]?.nombre ?? 'Categoría',
      categoryIcon: categoryLookup[entry.categoria_id]?.icono ?? '🍽️',
      dishTypeName: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
      restaurantName:
        restaurantLookup[entry.restaurant_id]?.nombre ?? 'Restaurante',
      dishLabel: getDishTypeLabel(
        dishTypeLookup[entry.tipo_plato_id],
        entry.nombre_plato,
      ),
    }))
}

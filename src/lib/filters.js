import { hasValidCoordinates } from './maps.js'

export const DEFAULT_FILTERS = {
  categoryIds: [],
  dishTypeIds: [],
  year: '',
  onlyWithPhoto: false,
  priceRanges: [],
  authorIds: [],
  radiusKm: '',
  minimumScore: 0,
}

export const PRICE_RANGE_OPTIONS = ['€', '€€', '€€€']

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))]
}

function getEntryYear(entry) {
  const source = entry.fecha || entry.created_at

  if (!source) {
    return ''
  }

  return String(new Date(source).getFullYear())
}

function distanceInKm(pointA, pointB) {
  const earthRadius = 6371
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(pointB.lat - pointA.lat)
  const dLng = toRadians(pointB.lng - pointA.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(pointA.lat)) *
      Math.cos(toRadians(pointB.lat)) *
      Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getAllowedDishTypeIds(dishTypes, categoryIds) {
  if (!categoryIds.length) {
    return new Set(dishTypes.map((dishType) => dishType.id))
  }

  return new Set(
    dishTypes
      .filter((dishType) => categoryIds.includes(dishType.categoria_id))
      .map((dishType) => dishType.id),
  )
}

export function normalizeFilters(rawFilters, dishTypes = []) {
  const categoryIds = uniqueValues(rawFilters?.categoryIds ?? [])
  const allowedDishTypeIds = getAllowedDishTypeIds(dishTypes, categoryIds)
  const dishTypeIds = uniqueValues(rawFilters?.dishTypeIds ?? []).filter((dishTypeId) =>
    allowedDishTypeIds.has(dishTypeId),
  )
  const priceRanges = uniqueValues(rawFilters?.priceRanges ?? []).filter((priceRange) =>
    PRICE_RANGE_OPTIONS.includes(priceRange),
  )
  const authorIds = uniqueValues(rawFilters?.authorIds ?? [])
  const year = rawFilters?.year ? String(rawFilters.year) : ''
  const radiusValue = Number(rawFilters?.radiusKm)
  const minimumScoreValue = Number(rawFilters?.minimumScore ?? 0)

  return {
    categoryIds,
    dishTypeIds,
    year,
    onlyWithPhoto: Boolean(rawFilters?.onlyWithPhoto),
    priceRanges,
    authorIds,
    radiusKm:
      Number.isFinite(radiusValue) && radiusValue > 0 ? String(radiusValue) : '',
    minimumScore:
      Number.isFinite(minimumScoreValue) && minimumScoreValue > 0
        ? Number(minimumScoreValue.toFixed(1))
        : 0,
  }
}

export function buildAvailableFilterOptions({ categories, dishTypes, entries, users }) {
  const years = uniqueValues(entries.map(getEntryYear))
    .filter(Boolean)
    .sort((left, right) => Number(right) - Number(left))

  return {
    categories,
    dishTypes,
    users,
    years,
    priceRanges: PRICE_RANGE_OPTIONS,
  }
}

export function filterDishEntries({
  dishTypes,
  entries,
  filters,
  filterOrigin,
  restaurantsById,
}) {
  const safeFilters = normalizeFilters(filters, dishTypes)
  const numericRadius = Number(safeFilters.radiusKm)
  const numericMinimumScore = Number(safeFilters.minimumScore)

  return entries.filter((entry) => {
    if (
      safeFilters.categoryIds.length &&
      !safeFilters.categoryIds.includes(entry.categoria_id)
    ) {
      return false
    }

    if (
      safeFilters.dishTypeIds.length &&
      !safeFilters.dishTypeIds.includes(entry.tipo_plato_id)
    ) {
      return false
    }

    if (safeFilters.year && getEntryYear(entry) !== safeFilters.year) {
      return false
    }

    if (safeFilters.onlyWithPhoto && !entry.foto_url) {
      return false
    }

    if (
      safeFilters.authorIds.length &&
      !safeFilters.authorIds.includes(entry.created_by_user_id)
    ) {
      return false
    }

    if (
      numericMinimumScore > 0 &&
      Number(entry.puntuacion_general ?? 0) < numericMinimumScore
    ) {
      return false
    }

    const restaurant = restaurantsById[entry.restaurant_id]

    if (!restaurant) {
      return false
    }

    if (
      safeFilters.priceRanges.length &&
      !safeFilters.priceRanges.includes(restaurant.precio_rango)
    ) {
      return false
    }

    if (numericRadius > 0) {
      if (!hasValidCoordinates(filterOrigin) || !hasValidCoordinates(restaurant)) {
        return false
      }

      const distance = distanceInKm(
        {
          lat: Number(filterOrigin.lat),
          lng: Number(filterOrigin.lng),
        },
        {
          lat: Number(restaurant.lat),
          lng: Number(restaurant.lng),
        },
      )

      if (distance > numericRadius) {
        return false
      }
    }

    return true
  })
}

export function buildActiveFilterChips({
  categories,
  dishTypes,
  filters,
  users,
}) {
  const safeFilters = normalizeFilters(filters, dishTypes)
  const categoryLookup = Object.fromEntries(categories.map((category) => [category.id, category]))
  const dishTypeLookup = Object.fromEntries(dishTypes.map((dishType) => [dishType.id, dishType]))
  const userLookup = Object.fromEntries(users.map((user) => [user.id, user]))

  return [
    ...safeFilters.categoryIds.map((categoryId) => ({
      id: `category:${categoryId}`,
      filterKey: 'categoryIds',
      value: categoryId,
      label: categoryLookup[categoryId]?.nombre ?? 'Categoría',
    })),
    ...safeFilters.dishTypeIds.map((dishTypeId) => ({
      id: `dishType:${dishTypeId}`,
      filterKey: 'dishTypeIds',
      value: dishTypeId,
      label: dishTypeLookup[dishTypeId]?.nombre ?? 'Tipo de plato',
    })),
    ...(safeFilters.year
      ? [
          {
            id: `year:${safeFilters.year}`,
            filterKey: 'year',
            value: safeFilters.year,
            label: `Año ${safeFilters.year}`,
          },
        ]
      : []),
    ...(safeFilters.onlyWithPhoto
      ? [
          {
            id: 'onlyWithPhoto:true',
            filterKey: 'onlyWithPhoto',
            value: true,
            label: 'Solo con foto',
          },
        ]
      : []),
    ...safeFilters.priceRanges.map((priceRange) => ({
      id: `price:${priceRange}`,
      filterKey: 'priceRanges',
      value: priceRange,
      label: `Precio ${priceRange}`,
    })),
    ...safeFilters.authorIds.map((authorId) => ({
      id: `author:${authorId}`,
      filterKey: 'authorIds',
      value: authorId,
      label: userLookup[authorId]?.nombre
        ? `Autor ${userLookup[authorId].nombre}`
        : 'Autor',
    })),
    ...(safeFilters.radiusKm
      ? [
          {
            id: `radius:${safeFilters.radiusKm}`,
            filterKey: 'radiusKm',
            value: safeFilters.radiusKm,
            label: `${safeFilters.radiusKm} km`,
          },
        ]
      : []),
    ...(safeFilters.minimumScore > 0
      ? [
          {
            id: `minimumScore:${safeFilters.minimumScore}`,
            filterKey: 'minimumScore',
            value: safeFilters.minimumScore,
            label: `Mín. ${safeFilters.minimumScore.toFixed(1)}`,
          },
        ]
      : []),
  ]
}

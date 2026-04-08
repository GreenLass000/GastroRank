export const LOCATION_REQUIRED_MESSAGE =
  'La ubicación es obligatoria. Búscala con IA, selecciona en el mapa o usa tu ubicación actual.'

export const GROUP_TYPES = ['pareja', 'amigos', 'familia', 'otros']
export const GROUP_VISIBILITIES = ['privado', 'público']
export const GROUP_JOIN_POLICIES = ['código', 'aprobación', 'abierto']
export const CATEGORY_SCOPES = ['global', 'grupo', 'usuario']
export const ENTRY_VISIBILITIES = ['private', 'group', 'public']
export const PRICE_RANGES = ['€', '€€', '€€€']

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value) {
  const trimmed = asTrimmedString(value)
  return trimmed || null
}

function coerceNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? null : numericValue
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => asTrimmedString(tag)).filter(Boolean)
  }

  return asTrimmedString(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function normalizeEntityName(value) {
  return asTrimmedString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function isImageValuePreviewable(value) {
  const normalizedValue = asTrimmedString(value)

  if (!normalizedValue) {
    return false
  }

  return (
    normalizedValue.startsWith('data:image/') ||
    normalizedValue.startsWith('blob:') ||
    normalizedValue.startsWith('http://') ||
    normalizedValue.startsWith('https://') ||
    normalizedValue.startsWith('/')
  )
}

export function distanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function validateUserPayload(payload) {
  const nombre = asTrimmedString(payload.nombre)

  if (!nombre) {
    throw new Error('El nombre del perfil es obligatorio.')
  }

  return {
    nombre,
    avatar_url: asTrimmedString(payload.avatar_url),
  }
}

export function validateGroupPayload(payload, { requireCreator = false } = {}) {
  const normalizedPayload = {
    nombre: asTrimmedString(payload.nombre),
    tipo: asTrimmedString(payload.tipo),
    visibility: asTrimmedString(payload.visibility),
    join_policy: asTrimmedString(payload.join_policy),
    created_by_user_id: asTrimmedString(payload.created_by_user_id),
  }

  if (!normalizedPayload.nombre) {
    throw new Error('El grupo necesita un nombre.')
  }

  if (!GROUP_TYPES.includes(normalizedPayload.tipo)) {
    throw new Error('El tipo de grupo no es válido.')
  }

  if (!GROUP_VISIBILITIES.includes(normalizedPayload.visibility)) {
    throw new Error('La visibilidad del grupo no es válida.')
  }

  if (!GROUP_JOIN_POLICIES.includes(normalizedPayload.join_policy)) {
    throw new Error('La política de acceso no es válida.')
  }

  if (requireCreator && !normalizedPayload.created_by_user_id) {
    throw new Error('Falta el usuario creador del grupo.')
  }

  return normalizedPayload
}

export function validateRestaurantPayload(
  payload,
  restaurants = [],
  { excludeId = '' } = {},
) {
  const nombre = asTrimmedString(payload.nombre)
  const lat = coerceNumber(payload.lat)
  const lng = coerceNumber(payload.lng)

  if (!nombre) {
    throw new Error('El nombre del restaurante es obligatorio.')
  }

  if (lat === null || lng === null) {
    throw new Error(LOCATION_REQUIRED_MESSAGE)
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Las coordenadas del restaurante no son válidas.')
  }

  const nombreNormalizado = normalizeEntityName(nombre)
  const duplicateRestaurant = restaurants.find((restaurant) => {
    if (restaurant.id === excludeId) {
      return false
    }

    const sameName =
      normalizeEntityName(restaurant.nombre) === nombreNormalizado
    const nearby =
      typeof restaurant.lat === 'number' &&
      typeof restaurant.lng === 'number' &&
      distanceInMeters(lat, lng, restaurant.lat, restaurant.lng) < 50

    return sameName && nearby
  })

  if (duplicateRestaurant) {
    throw new Error(
      `Ya existe un restaurante similar: ${duplicateRestaurant.nombre}. Revisa si es el mismo lugar.`,
    )
  }

  return {
    nombre,
    nombre_normalizado: nombreNormalizado,
    direccion_texto: asTrimmedString(payload.direccion_texto),
    google_maps_url: asTrimmedString(payload.google_maps_url),
    lat,
    lng,
    precio_rango: PRICE_RANGES.includes(asTrimmedString(payload.precio_rango))
      ? asTrimmedString(payload.precio_rango)
      : PRICE_RANGES[0],
    tags: normalizeTags(payload.tags),
    notas: asTrimmedString(payload.notas),
    created_by_user_id: asTrimmedString(payload.created_by_user_id),
    cover_photo_url: asTrimmedString(payload.cover_photo_url),
  }
}

export function validateCategoryPayload(
  payload,
  categories = [],
  { excludeId = '' } = {},
) {
  const nombre = asTrimmedString(payload.nombre)

  if (!nombre) {
    throw new Error('La categoría necesita un nombre.')
  }

  const duplicateCategory = categories.find((category) => {
    if (category.id === excludeId) {
      return false
    }

    return normalizeEntityName(category.nombre) === normalizeEntityName(nombre)
  })

  if (duplicateCategory) {
    throw new Error(`La categoría "${duplicateCategory.nombre}" ya existe.`)
  }

  const scope = asTrimmedString(payload.scope) || 'usuario'
  if (!CATEGORY_SCOPES.includes(scope)) {
    throw new Error('El scope de la categoría no es válido.')
  }

  return {
    nombre,
    icono: asTrimmedString(payload.icono) || '🍽️',
    scope,
    created_by_user_id: asNullableString(payload.created_by_user_id),
  }
}

export function validateDishTypePayload(
  payload,
  dishTypes = [],
  { excludeId = '' } = {},
) {
  const categoriaId = asTrimmedString(payload.categoria_id)
  const nombre = asTrimmedString(payload.nombre)

  if (!categoriaId) {
    throw new Error('Falta la categoría del tipo de plato.')
  }

  if (!nombre) {
    throw new Error('El tipo de plato necesita un nombre.')
  }

  const duplicateDishType = dishTypes.find((dishType) => {
    if (dishType.id === excludeId) {
      return false
    }

    return (
      dishType.categoria_id === categoriaId &&
      normalizeEntityName(dishType.nombre) === normalizeEntityName(nombre)
    )
  })

  if (duplicateDishType) {
    throw new Error(
      `El tipo de plato "${duplicateDishType.nombre}" ya existe en esa categoría.`,
    )
  }

  const scope = asTrimmedString(payload.scope) || 'usuario'
  if (!CATEGORY_SCOPES.includes(scope)) {
    throw new Error('El scope del tipo de plato no es válido.')
  }

  return {
    categoria_id: categoriaId,
    nombre,
    alias: asNullableString(payload.alias),
    scope,
    created_by_user_id: asNullableString(payload.created_by_user_id),
  }
}

export function validateDishEntryPayload(
  payload,
  dishEntries = [],
  { excludeId = '' } = {},
) {
  const normalizedPayload = {
    restaurant_id: asTrimmedString(payload.restaurant_id),
    categoria_id: asTrimmedString(payload.categoria_id),
    tipo_plato_id: asTrimmedString(payload.tipo_plato_id),
    nombre_plato: asNullableString(payload.nombre_plato),
    sabor: coerceNumber(payload.sabor),
    textura: coerceNumber(payload.textura),
    presentacion: coerceNumber(payload.presentacion),
    calidad_precio: coerceNumber(payload.calidad_precio),
    precio_plato: coerceNumber(payload.precio_plato),
    notas: asNullableString(payload.notas),
    fecha: asTrimmedString(payload.fecha),
    foto_url: asNullableString(payload.foto_url),
    created_by_user_id: asTrimmedString(payload.created_by_user_id),
    group_id: asNullableString(payload.group_id),
    visibility: asTrimmedString(payload.visibility),
  }

  const requiredFields = [
    ['restaurant_id', 'Falta el restaurante.'],
    ['categoria_id', 'Falta la categoría.'],
    ['tipo_plato_id', 'Falta el tipo de plato.'],
    ['created_by_user_id', 'Falta el autor de la valoración.'],
    ['visibility', 'Falta la visibilidad.'],
    ['fecha', 'Falta la fecha de la valoración.'],
  ]

  for (const [field, message] of requiredFields) {
    if (!normalizedPayload[field]) {
      throw new Error(message)
    }
  }

  if (!ENTRY_VISIBILITIES.includes(normalizedPayload.visibility)) {
    throw new Error('La visibilidad de la valoración no es válida.')
  }

  const validScoreEntries = Object.entries({
    sabor: normalizedPayload.sabor,
    textura: normalizedPayload.textura,
    presentacion: normalizedPayload.presentacion,
    calidad_precio: normalizedPayload.calidad_precio,
  }).filter(([, value]) => value !== null)

  if (validScoreEntries.length === 0) {
    throw new Error('Introduce al menos una subpuntuación.')
  }

  for (const [field, value] of validScoreEntries) {
    if (value < 0 || value > 10) {
      throw new Error(`La puntuación "${field}" debe estar entre 0.0 y 10.0.`)
    }
  }

  const duplicateEntry = dishEntries.find((entry) => {
    if (entry.id === excludeId) {
      return false
    }

    return (
      entry.created_by_user_id === normalizedPayload.created_by_user_id &&
      entry.restaurant_id === normalizedPayload.restaurant_id &&
      entry.tipo_plato_id === normalizedPayload.tipo_plato_id &&
      entry.fecha === normalizedPayload.fecha
    )
  })

  if (duplicateEntry) {
    throw new Error(
      'Ya existe una valoración de ese usuario para el mismo plato, restaurante y fecha.',
    )
  }

  if (normalizedPayload.visibility === 'group' && !normalizedPayload.group_id) {
    throw new Error('Las entradas visibles para grupo necesitan un group_id.')
  }

  return normalizedPayload
}

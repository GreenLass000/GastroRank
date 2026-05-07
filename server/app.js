import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { and, asc, desc, eq } from 'drizzle-orm'
import { ACHIEVEMENT_TYPES } from '../src/lib/achievements.js'
import {
  validateCategoryPayload,
  validateDishEntryPayload,
  validateDishTypePayload,
  validateGroupPayload,
  validateRestaurantPayload,
  validateUserPayload,
} from '../src/lib/validation.js'
import { db } from './db/client.js'
import * as schema from './db/schema.js'

const PORT = Number(process.env.PORT ?? 3030)
const HOST = process.env.HOST ?? '0.0.0.0'
const MAX_REQUEST_BODY_BYTES = 80 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 120
const requestBuckets = new Map()

// ---------------------------------------------------------------------------
// DB fetch helpers (replaces ROUTE_QUERIES + runJsonQuery)
// ---------------------------------------------------------------------------

const FETCH = {
  users: () => db.select().from(schema.users).orderBy(asc(schema.users.created_at)),
  groups: () => db.select().from(schema.groups).orderBy(asc(schema.groups.created_at)),
  groupMembers: () =>
    db.select().from(schema.groupMembers).orderBy(asc(schema.groupMembers.joined_at)),
  restaurants: () =>
    db.select().from(schema.restaurants).orderBy(asc(schema.restaurants.created_at)),
  categories: () => db.select().from(schema.categories).orderBy(asc(schema.categories.nombre)),
  dishTypes: () => db.select().from(schema.dishTypes).orderBy(asc(schema.dishTypes.nombre)),
  dishEntries: () =>
    db.select().from(schema.dishEntries).orderBy(asc(schema.dishEntries.created_at)),
  publicShareTokens: () =>
    db
      .select()
      .from(schema.publicShareTokens)
      .orderBy(asc(schema.publicShareTokens.created_at)),
  follows: () => db.select().from(schema.follows).orderBy(desc(schema.follows.created_at)),
  reactions: () =>
    db.select().from(schema.reactions).orderBy(desc(schema.reactions.created_at)),
  comments: () => db.select().from(schema.comments).orderBy(asc(schema.comments.created_at)),
  inspirationLists: () =>
    db
      .select()
      .from(schema.inspirationLists)
      .orderBy(asc(schema.inspirationLists.created_at)),
  inspirationListItems: () =>
    db
      .select()
      .from(schema.inspirationListItems)
      .orderBy(desc(schema.inspirationListItems.saved_at)),
  recommendations: () =>
    db
      .select()
      .from(schema.recommendations)
      .orderBy(desc(schema.recommendations.created_at)),
  achievements: () =>
    db
      .select()
      .from(schema.achievements)
      .orderBy(desc(schema.achievements.unlocked_at)),
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function getClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return request.socket.remoteAddress || 'unknown'
}

function pruneRateLimitBuckets(now) {
  requestBuckets.forEach((bucket, key) => {
    if (now - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      requestBuckets.delete(key)
    }
  })
}

function enforceRateLimit(request, response) {
  const now = Date.now()
  pruneRateLimitBuckets(now)
  const clientIp = getClientIp(request)
  const bucket = requestBuckets.get(clientIp)

  if (!bucket || now - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(clientIp, { count: 1, windowStartedAt: now })
    return false
  }

  bucket.count += 1

  if (bucket.count <= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  response.writeHead(429, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
  })
  response.end(
    JSON.stringify({
      error: 'Demasiadas peticiones seguidas. Espera un momento e inténtalo otra vez.',
    }),
  )
  return true
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    let totalBytes = 0

    request.on('data', (chunk) => {
      totalBytes += chunk.length

      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        reject(new Error('La petición es demasiado grande.'))
        request.destroy()
        return
      }

      body += chunk
    })

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('JSON inválido.'))
      }
    })

    request.on('error', reject)
  })
}

function ensureJsonRequest(request) {
  const contentType = request.headers['content-type'] ?? ''

  if (!String(contentType).toLowerCase().startsWith('application/json')) {
    throw new Error('La petición debe usar Content-Type: application/json.')
  }
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined) {
    return fallback
  }

  // PostgreSQL JSONB columns come back already parsed
  if (typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function parseRestaurantRows(rows) {
  return rows.map((r) => ({
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : parseJsonValue(r.tags, []),
  }))
}

function calculateGeneralScore(entry) {
  const values = [entry.sabor, entry.textura, entry.presentacion, entry.calidad_precio].filter(
    (v) => typeof v === 'number' && !Number.isNaN(v),
  )

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, v) => sum + v, 0)
  return Number((total / values.length).toFixed(1))
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getRequiredString(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    throw new Error(`Falta ${label}.`)
  }

  return normalized
}

function getOptionalString(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function getCurrentUserIdFromSearchParams(searchParams) {
  const userId =
    searchParams.get('user_id') ??
    searchParams.get('current_user_id') ??
    searchParams.get('viewer_user_id')

  return getRequiredString(userId, 'el user_id actual')
}

function normalizeReactionType(value) {
  const reactionType = getRequiredString(value, 'el tipo de reacción')
  const allowed = ['quiero_probar', 'ya_probe', 'que_hambre', 'mejorable', 'paso']

  if (!allowed.includes(reactionType)) {
    throw new Error('El tipo de reacción no es válido.')
  }

  return reactionType
}

function sanitizeMentions(rawMentions) {
  if (rawMentions === null || rawMentions === undefined) {
    return []
  }

  if (!Array.isArray(rawMentions)) {
    throw new Error('Las menciones deben ser un array JSON.')
  }

  if (rawMentions.length > 20) {
    throw new Error('No se permiten más de 20 menciones por comentario.')
  }

  return rawMentions.map((mention, index) => {
    if (!mention || typeof mention !== 'object') {
      throw new Error(`La mención ${index + 1} no es válida.`)
    }

    const type = getRequiredString(mention.type, `el tipo de la mención ${index + 1}`)
    const value = getRequiredString(mention.value, `el valor de la mención ${index + 1}`)
    const allowedTypes = ['user', 'restaurant', 'dish']

    if (!allowedTypes.includes(type)) {
      throw new Error(`La mención ${index + 1} tiene un tipo no soportado.`)
    }

    if (value.length > 120) {
      throw new Error(`La mención ${index + 1} es demasiado larga.`)
    }

    const label = getOptionalString(mention.label)

    if (type === 'user' && !/^[a-zA-Z0-9-]+$/.test(value)) {
      throw new Error(`La mención ${index + 1} de usuario no es válida.`)
    }

    if (type !== 'user' && /[<>]/.test(value)) {
      throw new Error(`La mención ${index + 1} contiene caracteres no permitidos.`)
    }

    if (label && /[<>]/.test(label)) {
      throw new Error(`La etiqueta de la mención ${index + 1} no es válida.`)
    }

    return {
      type,
      value,
      ...(label ? { label: label.slice(0, 120) } : {}),
    }
  })
}

function parseFilters(searchParams) {
  const filtersFromJson = parseJsonValue(searchParams.get('filters'), {})
  const categoryIds =
    filtersFromJson.categoryIds ??
    filtersFromJson.categoriaIds ??
    parseJsonValue(searchParams.get('category_ids'), [])
  const dishTypeIds =
    filtersFromJson.dishTypeIds ??
    filtersFromJson.tipoPlatoIds ??
    parseJsonValue(searchParams.get('dish_type_ids'), [])
  const priceRange =
    filtersFromJson.priceRange ??
    filtersFromJson.precioRango ??
    searchParams.get('price_range') ??
    searchParams.get('precio_rango')
  const minScore =
    filtersFromJson.minScore ??
    filtersFromJson.puntuacionMinima ??
    searchParams.get('min_score') ??
    searchParams.get('puntuacion_minima')
  const dateFrom =
    filtersFromJson.dateFrom ??
    filtersFromJson.fechaDesde ??
    searchParams.get('date_from') ??
    searchParams.get('fecha_desde')
  const dateTo =
    filtersFromJson.dateTo ??
    filtersFromJson.fechaHasta ??
    searchParams.get('date_to') ??
    searchParams.get('fecha_hasta')

  return {
    categoryIds: Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : [],
    dishTypeIds: Array.isArray(dishTypeIds) ? dishTypeIds.filter(Boolean) : [],
    priceRange:
      Array.isArray(priceRange) && priceRange.length > 0
        ? priceRange
        : typeof priceRange === 'string' && priceRange.trim()
          ? [priceRange.trim()]
          : [],
    minScore:
      minScore === null || minScore === undefined || minScore === ''
        ? null
        : Number(minScore),
    dateFrom: typeof dateFrom === 'string' && dateFrom.trim() ? dateFrom.trim() : null,
    dateTo: typeof dateTo === 'string' && dateTo.trim() ? dateTo.trim() : null,
  }
}

function getWeekStart(dateInput) {
  const date = new Date(dateInput)
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() - day + 1)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

function calculateWeeklyStreak(dishEntries, userId) {
  const userEntries = dishEntries.filter((e) => e.created_by_user_id === userId)

  if (userEntries.length === 0) {
    return 0
  }

  const entryWeeks = new Set(
    userEntries.map((e) => getWeekStart(e.created_at ?? e.fecha).toISOString()),
  )
  let streak = 0
  const cursor = getWeekStart(new Date().toISOString())

  while (entryWeeks.has(cursor.toISOString())) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }

  return streak
}

function buildUserLookup(users) {
  return new Map(users.map((u) => [u.id, u]))
}

function buildReactionSummary(reactions) {
  const summary = new Map()

  reactions.forEach((r) => {
    summary.set(r.reaction_type, (summary.get(r.reaction_type) ?? 0) + 1)
  })

  return Array.from(summary.entries())
    .map(([reaction_type, count]) => ({ reaction_type, count }))
    .sort(
      (a, b) => b.count - a.count || a.reaction_type.localeCompare(b.reaction_type),
    )
}

function buildCommunityEntry(entry, context) {
  const restaurant = context.restaurantsById.get(entry.restaurant_id) ?? null
  const author = context.usersById.get(entry.created_by_user_id) ?? null
  const category = context.categoriesById.get(entry.categoria_id) ?? null
  const dishType = context.dishTypesById.get(entry.tipo_plato_id) ?? null
  const entryReactions = context.reactionsByEntryId.get(entry.id) ?? []
  const entryComments = context.commentsByEntryId.get(entry.id) ?? []

  return {
    ...entry,
    restaurant,
    author,
    category,
    dishType,
    reactions_summary: buildReactionSummary(entryReactions),
    reactions_total: entryReactions.length,
    comments_count: entryComments.length,
    user_reaction:
      entryReactions.find((r) => r.user_id === context.currentUserId) ?? null,
  }
}

function ensureRecordExists(rows, id, label) {
  const record = rows.find((r) => r.id === id)

  if (!record) {
    throw new Error(`No existe ${label}.`)
  }

  return record
}

function buildMutualFollowIds(follows, currentUserId) {
  const followingIds = new Set(
    follows
      .filter((f) => f.follower_user_id === currentUserId)
      .map((f) => f.followed_user_id),
  )
  const followerIds = new Set(
    follows
      .filter((f) => f.followed_user_id === currentUserId)
      .map((f) => f.follower_user_id),
  )

  return new Set(Array.from(followingIds).filter((id) => followerIds.has(id)))
}

function buildSharedGroupIds(groupMembers, currentUserId, otherUserId) {
  const currentGroupIds = new Set(
    groupMembers
      .filter((m) => m.user_id === currentUserId && m.status === 'active')
      .map((m) => m.group_id),
  )

  return new Set(
    groupMembers
      .filter(
        (m) =>
          m.user_id === otherUserId &&
          m.status === 'active' &&
          currentGroupIds.has(m.group_id),
      )
      .map((m) => m.group_id),
  )
}

function generateInviteCode() {
  return randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
}

function generatePublicShareToken() {
  return randomUUID().replaceAll('-', '').slice(0, 16)
}

async function generateUniqueInviteCode() {
  const groups = await FETCH.groups()
  const existingCodes = new Set(groups.map((g) => g.invite_code))

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = generateInviteCode()

    if (!existingCodes.has(code)) {
      return code
    }
  }

  throw new Error('No se pudo generar un código de invitación único.')
}

async function generateUniquePublicShareToken() {
  const tokens = await FETCH.publicShareTokens()
  const existingTokens = new Set(tokens.map((t) => t.token))

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const token = generatePublicShareToken()

    if (!existingTokens.has(token)) {
      return token
    }
  }

  throw new Error('No se pudo generar un token público único.')
}

// ---------------------------------------------------------------------------
// CRUD operations (Drizzle)
// ---------------------------------------------------------------------------

async function createRestaurant(payload) {
  const restaurants = parseRestaurantRows(await FETCH.restaurants())
  const p = validateRestaurantPayload(payload, restaurants)

  if (!p.created_by_user_id) {
    throw new Error('Falta el usuario creador del restaurante.')
  }

  const record = {
    id: randomUUID(),
    nombre: p.nombre,
    nombre_normalizado: p.nombre_normalizado,
    direccion_texto: p.direccion_texto,
    google_maps_url:
      p.google_maps_url || `https://maps.google.com/?q=${p.lat},${p.lng}`,
    lat: p.lat,
    lng: p.lng,
    precio_rango: p.precio_rango,
    tags: p.tags,
    notas: p.notas,
    created_at: new Date().toISOString(),
    created_by_user_id: p.created_by_user_id,
    cover_photo_url: p.cover_photo_url,
  }

  await db.insert(schema.restaurants).values(record)
  return record
}

async function createGroup(payload) {
  const p = validateGroupPayload(payload, { requireCreator: true })
  const createdAt = new Date().toISOString()

  const groupRecord = {
    id: randomUUID(),
    nombre: p.nombre,
    tipo: p.tipo,
    visibility: p.visibility,
    join_policy: p.join_policy,
    invite_code: await generateUniqueInviteCode(),
    created_by_user_id: p.created_by_user_id,
    created_at: createdAt,
  }

  const groupMemberRecord = {
    id: randomUUID(),
    group_id: groupRecord.id,
    user_id: p.created_by_user_id,
    role: 'owner',
    status: 'active',
    joined_at: createdAt,
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.groups).values(groupRecord)
    await tx.insert(schema.groupMembers).values(groupMemberRecord)
  })

  return { group: groupRecord, groupMember: groupMemberRecord }
}

async function createCategory(payload) {
  const existing = await FETCH.categories()
  const p = validateCategoryPayload(payload, existing)
  const record = { id: randomUUID(), ...p }
  await db.insert(schema.categories).values(record)
  return record
}

async function createDishType(payload) {
  const existing = await FETCH.dishTypes()
  const p = validateDishTypePayload(payload, existing)
  const record = { id: randomUUID(), ...p }
  await db.insert(schema.dishTypes).values(record)
  return record
}

async function createPublicShareToken(payload) {
  const context = payload.context?.trim()
  const rankingType = payload.ranking_type?.trim()
  const createdByUserId = payload.created_by_user_id?.trim()
  const groupId = payload.group_id?.trim() || null
  const filters = payload.filters ?? {}
  const allowedContexts = ['mi_ranking', 'grupo', 'comunidad']

  if (!allowedContexts.includes(context)) {
    throw new Error('El contexto de share no es válido.')
  }

  if (!rankingType) {
    throw new Error('Falta el tipo de ranking para compartir.')
  }

  if (!createdByUserId) {
    throw new Error('Falta el autor del enlace compartido.')
  }

  if (context === 'grupo' && !groupId) {
    throw new Error('El share de grupo necesita un group_id.')
  }

  const record = {
    id: randomUUID(),
    token: await generateUniquePublicShareToken(),
    context,
    ranking_type: rankingType,
    filters_json: filters,
    group_id: groupId,
    created_by_user_id: createdByUserId,
    created_at: new Date().toISOString(),
    expires_at: null,
  }

  await db.insert(schema.publicShareTokens).values(record)
  return { ...record, filters }
}

async function createDishEntry(payload) {
  const existing = await FETCH.dishEntries()
  const p = validateDishEntryPayload(payload, existing)

  const { puntuacion_general: _computed, ...insertValues } = {
    id: randomUUID(),
    ...p,
    created_at: new Date().toISOString(),
  }

  const [inserted] = await db
    .insert(schema.dishEntries)
    .values(insertValues)
    .returning()

  return inserted ?? {
    ...insertValues,
    puntuacion_general: calculateGeneralScore(insertValues),
  }
}

async function updateUser(userId, payload) {
  const users = await FETCH.users()
  ensureRecordExists(users, userId, 'el usuario solicitado')
  const p = validateUserPayload(payload)

  const [updated] = await db
    .update(schema.users)
    .set({ nombre: p.nombre, avatar_url: p.avatar_url })
    .where(eq(schema.users.id, userId))
    .returning()

  return updated
}

async function updateGroup(groupId, payload) {
  const groups = await FETCH.groups()
  const current = ensureRecordExists(groups, groupId, 'el grupo solicitado')
  const p = validateGroupPayload({ ...current, ...payload, created_by_user_id: current.created_by_user_id })

  const [updated] = await db
    .update(schema.groups)
    .set({ nombre: p.nombre, tipo: p.tipo, visibility: p.visibility, join_policy: p.join_policy })
    .where(eq(schema.groups.id, groupId))
    .returning()

  return updated
}

async function updateRestaurant(restaurantId, payload) {
  const restaurants = parseRestaurantRows(await FETCH.restaurants())
  const current = ensureRecordExists(restaurants, restaurantId, 'el restaurante solicitado')
  const p = validateRestaurantPayload(
    { ...current, ...payload, created_by_user_id: current.created_by_user_id },
    restaurants,
    { excludeId: restaurantId },
  )

  const [updated] = await db
    .update(schema.restaurants)
    .set({
      nombre: p.nombre,
      nombre_normalizado: p.nombre_normalizado,
      direccion_texto: p.direccion_texto,
      google_maps_url:
        p.google_maps_url || `https://maps.google.com/?q=${p.lat},${p.lng}`,
      lat: p.lat,
      lng: p.lng,
      precio_rango: p.precio_rango,
      tags: p.tags,
      notas: p.notas,
      cover_photo_url: p.cover_photo_url,
    })
    .where(eq(schema.restaurants.id, restaurantId))
    .returning()

  return updated
}

async function updateCategory(categoryId, payload) {
  const categories = await FETCH.categories()
  const current = ensureRecordExists(categories, categoryId, 'la categoría solicitada')
  const p = validateCategoryPayload(
    { ...current, ...payload, created_by_user_id: current.created_by_user_id },
    categories,
    { excludeId: categoryId },
  )

  const [updated] = await db
    .update(schema.categories)
    .set({ nombre: p.nombre, icono: p.icono, scope: p.scope })
    .where(eq(schema.categories.id, categoryId))
    .returning()

  return updated
}

async function updateDishType(dishTypeId, payload) {
  const dishTypes = await FETCH.dishTypes()
  const current = ensureRecordExists(dishTypes, dishTypeId, 'el tipo de plato solicitado')
  const p = validateDishTypePayload(
    { ...current, ...payload, created_by_user_id: current.created_by_user_id },
    dishTypes,
    { excludeId: dishTypeId },
  )

  const [updated] = await db
    .update(schema.dishTypes)
    .set({ categoria_id: p.categoria_id, nombre: p.nombre, alias: p.alias, scope: p.scope })
    .where(eq(schema.dishTypes.id, dishTypeId))
    .returning()

  return updated
}

async function updateDishEntry(dishEntryId, payload) {
  const dishEntries = await FETCH.dishEntries()
  const current = ensureRecordExists(dishEntries, dishEntryId, 'la valoración solicitada')
  const p = validateDishEntryPayload(
    { ...current, ...payload, created_by_user_id: current.created_by_user_id },
    dishEntries,
    { excludeId: dishEntryId },
  )

  const [updated] = await db
    .update(schema.dishEntries)
    .set({
      restaurant_id: p.restaurant_id,
      categoria_id: p.categoria_id,
      tipo_plato_id: p.tipo_plato_id,
      nombre_plato: p.nombre_plato,
      sabor: p.sabor,
      textura: p.textura,
      presentacion: p.presentacion,
      calidad_precio: p.calidad_precio,
      precio_plato: p.precio_plato,
      notas: p.notas,
      fecha: p.fecha,
      foto_url: p.foto_url,
      group_id: p.group_id,
      visibility: p.visibility,
    })
    .where(eq(schema.dishEntries.id, dishEntryId))
    .returning()

  return updated ?? { ...current, ...p, puntuacion_general: calculateGeneralScore(p) }
}

async function getFollowState(userId) {
  const [users, follows] = await Promise.all([FETCH.users(), FETCH.follows()])
  ensureRecordExists(users, userId, 'el usuario solicitado')
  const usersById = buildUserLookup(users)
  const following = follows.filter((f) => f.follower_user_id === userId)
  const followers = follows.filter((f) => f.followed_user_id === userId)
  const followingIds = new Set(following.map((f) => f.followed_user_id))
  const followerIds = new Set(followers.map((f) => f.follower_user_id))
  const mutualIds = Array.from(followingIds).filter((id) => followerIds.has(id))

  return {
    follows: follows.filter(
      (f) => f.follower_user_id === userId || f.followed_user_id === userId,
    ),
    following: following.map((f) => ({
      ...f,
      user: usersById.get(f.followed_user_id) ?? null,
      id: f.followed_user_id,
    })),
    followers: followers.map((f) => ({
      ...f,
      user: usersById.get(f.follower_user_id) ?? null,
      id: f.follower_user_id,
    })),
    mutuals: mutualIds.map((id) => usersById.get(id)).filter(Boolean),
  }
}

async function createFollow(payload) {
  const followerUserId = getRequiredString(
    payload.follower_user_id ?? payload.current_user_id ?? payload.user_id,
    'el follower_user_id',
  )
  const followedUserId = getRequiredString(payload.followed_user_id, 'el followed_user_id')

  if (followerUserId === followedUserId) {
    throw new Error('No puedes seguirte a ti mismo.')
  }

  const [users, follows] = await Promise.all([FETCH.users(), FETCH.follows()])
  ensureRecordExists(users, followerUserId, 'el usuario seguidor')
  ensureRecordExists(users, followedUserId, 'el usuario a seguir')

  const existing = follows.find(
    (f) => f.follower_user_id === followerUserId && f.followed_user_id === followedUserId,
  )

  if (existing) {
    return existing
  }

  const record = {
    follower_user_id: followerUserId,
    followed_user_id: followedUserId,
    created_at: new Date().toISOString(),
  }

  await db.insert(schema.follows).values(record)
  return record
}

async function deleteFollow(currentUserId, followedUserId) {
  const follows = await FETCH.follows()
  const follow = follows.find(
    (f) =>
      f.follower_user_id === currentUserId && f.followed_user_id === followedUserId,
  )

  if (!follow) {
    throw new Error('No existe ese follow.')
  }

  await db
    .delete(schema.follows)
    .where(
      and(
        eq(schema.follows.follower_user_id, currentUserId),
        eq(schema.follows.followed_user_id, followedUserId),
      ),
    )

  return { ok: true }
}

async function getCommunityFeed(searchParams) {
  const currentUserId = getCurrentUserIdFromSearchParams(searchParams)
  const tab = searchParams.get('tab') === 'amigos' ? 'amigos' : 'explorar'
  const page = Math.max(1, parseInteger(searchParams.get('page'), 1))
  const pageSize = Math.min(30, Math.max(1, parseInteger(searchParams.get('page_size'), 10)))
  const filters = parseFilters(searchParams)

  const [
    users,
    restaurants,
    categories,
    dishTypes,
    dishEntries,
    follows,
    groupMembers,
    reactions,
    comments,
  ] = await Promise.all([
    FETCH.users(),
    FETCH.restaurants(),
    FETCH.categories(),
    FETCH.dishTypes(),
    FETCH.dishEntries(),
    FETCH.follows(),
    FETCH.groupMembers(),
    FETCH.reactions(),
    FETCH.comments(),
  ])

  ensureRecordExists(users, currentUserId, 'el usuario actual')
  const mutualFollowIds = buildMutualFollowIds(follows, currentUserId)
  const restaurantsById = new Map(
    parseRestaurantRows(restaurants).map((r) => [r.id, r]),
  )
  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const dishTypesById = new Map(dishTypes.map((d) => [d.id, d]))
  const usersById = buildUserLookup(users)
  const reactionsByEntryId = new Map()
  const commentsByEntryId = new Map()

  reactions.forEach((r) => {
    const list = reactionsByEntryId.get(r.dish_entry_id) ?? []
    list.push(r)
    reactionsByEntryId.set(r.dish_entry_id, list)
  })

  comments.forEach((c) => {
    const list = commentsByEntryId.get(c.dish_entry_id) ?? []
    list.push({ ...c, mentions: parseJsonValue(c.mentions, []) })
    commentsByEntryId.set(c.dish_entry_id, list)
  })

  let scoped = dishEntries.filter((e) => e.created_by_user_id !== currentUserId)

  if (tab === 'amigos') {
    scoped = scoped.filter((e) => {
      if (!mutualFollowIds.has(e.created_by_user_id)) return false
      if (e.visibility === 'public') return true

      if (e.visibility !== 'group' || !e.group_id) return false

      return buildSharedGroupIds(groupMembers, currentUserId, e.created_by_user_id).has(
        e.group_id,
      )
    })
  } else {
    scoped = scoped.filter((e) => e.visibility === 'public')
  }

  if (filters.categoryIds.length > 0) {
    scoped = scoped.filter((e) => filters.categoryIds.includes(e.categoria_id))
  }

  if (filters.dishTypeIds.length > 0) {
    scoped = scoped.filter((e) => filters.dishTypeIds.includes(e.tipo_plato_id))
  }

  if (filters.priceRange.length > 0) {
    scoped = scoped.filter((e) => {
      const r = restaurantsById.get(e.restaurant_id)
      return r && filters.priceRange.includes(r.precio_rango)
    })
  }

  if (typeof filters.minScore === 'number' && !Number.isNaN(filters.minScore)) {
    scoped = scoped.filter(
      (e) => Number(e.puntuacion_general ?? 0) >= filters.minScore,
    )
  }

  if (filters.dateFrom) {
    scoped = scoped.filter((e) => String(e.fecha) >= filters.dateFrom)
  }

  if (filters.dateTo) {
    scoped = scoped.filter((e) => String(e.fecha) <= filters.dateTo)
  }

  scoped.sort((a, b) => {
    const at = new Date(a.created_at ?? a.fecha).getTime()
    const bt = new Date(b.created_at ?? b.fecha).getTime()
    return bt - at
  })

  const totalItems = scoped.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize
  const context = {
    currentUserId,
    usersById,
    restaurantsById,
    categoriesById,
    dishTypesById,
    reactionsByEntryId,
    commentsByEntryId,
  }

  return {
    tab,
    page: currentPage,
    page_size: pageSize,
    total_items: totalItems,
    total_pages: totalPages,
    filters,
    entries: scoped
      .slice(offset, offset + pageSize)
      .map((e) => buildCommunityEntry(e, context)),
  }
}

async function addOrUpdateReaction(payload) {
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const reactionType = normalizeReactionType(payload.reaction_type)

  const [dishEntries, users] = await Promise.all([FETCH.dishEntries(), FETCH.users()])
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')
  ensureRecordExists(users, userId, 'el usuario')

  const record = {
    id: randomUUID(),
    dish_entry_id: dishEntryId,
    user_id: userId,
    reaction_type: reactionType,
    created_at: new Date().toISOString(),
  }

  await db
    .insert(schema.reactions)
    .values(record)
    .onConflictDoUpdate({
      target: [schema.reactions.dish_entry_id, schema.reactions.user_id],
      set: { reaction_type: reactionType },
    })

  return record
}

async function deleteReaction(reactionId) {
  const reactions = await FETCH.reactions()
  ensureRecordExists(reactions, reactionId, 'la reacción')
  await db.delete(schema.reactions).where(eq(schema.reactions.id, reactionId))
  return { ok: true }
}

async function getCommentsForEntry(entryId) {
  const [comments, users, dishEntries] = await Promise.all([
    FETCH.comments(),
    FETCH.users(),
    FETCH.dishEntries(),
  ])

  ensureRecordExists(dishEntries, entryId, 'la valoración')
  const usersById = buildUserLookup(users)

  return comments
    .filter((c) => c.dish_entry_id === entryId)
    .map((c) => ({
      ...c,
      mentions: parseJsonValue(c.mentions, []),
      user: usersById.get(c.user_id) ?? null,
    }))
}

async function createComment(payload) {
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const text = getRequiredString(payload.text, 'el texto del comentario')
  const mentions = sanitizeMentions(payload.mentions)

  if (text.length > 500) {
    throw new Error('El comentario no puede superar los 500 caracteres.')
  }

  const [dishEntries, users] = await Promise.all([FETCH.dishEntries(), FETCH.users()])
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')
  ensureRecordExists(users, userId, 'el usuario')

  const record = {
    id: randomUUID(),
    dish_entry_id: dishEntryId,
    user_id: userId,
    text,
    mentions,
    created_at: new Date().toISOString(),
  }

  await db.insert(schema.comments).values(record)

  return {
    ...record,
    user: ensureRecordExists(users, userId, 'el usuario del comentario'),
  }
}

async function getInspirationLists(userId) {
  const [users, lists, items, dishEntries] = await Promise.all([
    FETCH.users(),
    FETCH.inspirationLists(),
    FETCH.inspirationListItems(),
    FETCH.dishEntries(),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const entriesById = new Map(dishEntries.map((e) => [e.id, e]))

  return lists
    .filter((l) => l.user_id === userId)
    .map((l) => {
      const listItems = items
        .filter((i) => i.list_id === l.id)
        .map((i) => ({
          ...i,
          dish_entry: entriesById.get(i.dish_entry_id) ?? null,
        }))

      return { ...l, items: listItems, items_count: listItems.length }
    })
}

async function createInspirationList(payload) {
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const name = getRequiredString(payload.name, 'el nombre de la lista')
  const isDefault = Boolean(payload.is_default)

  const [users, lists] = await Promise.all([FETCH.users(), FETCH.inspirationLists()])
  ensureRecordExists(users, userId, 'el usuario')

  if (
    lists.some(
      (l) =>
        l.user_id === userId &&
        l.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
  ) {
    throw new Error('Ya existe una lista con ese nombre para este usuario.')
  }

  const record = {
    id: randomUUID(),
    user_id: userId,
    name,
    is_default: isDefault,
    created_at: new Date().toISOString(),
  }

  await db.insert(schema.inspirationLists).values(record)
  return record
}

async function createInspirationListItem(payload) {
  const listId = getRequiredString(payload.list_id, 'el list_id')
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const tried = Boolean(payload.tried)
  const now = new Date().toISOString()

  const [lists, dishEntries, items] = await Promise.all([
    FETCH.inspirationLists(),
    FETCH.dishEntries(),
    FETCH.inspirationListItems(),
  ])

  ensureRecordExists(lists, listId, 'la lista')
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')

  const existing = items.find(
    (i) => i.list_id === listId && i.dish_entry_id === dishEntryId,
  )

  if (existing) {
    return existing
  }

  const record = {
    id: randomUUID(),
    list_id: listId,
    dish_entry_id: dishEntryId,
    tried,
    tried_at: tried ? now : null,
    saved_at: now,
  }

  await db.insert(schema.inspirationListItems).values(record)
  return record
}

async function updateInspirationListItem(itemId, payload) {
  const items = await FETCH.inspirationListItems()
  const current = ensureRecordExists(items, itemId, 'el elemento de lista')

  if (payload.remove) {
    await db
      .delete(schema.inspirationListItems)
      .where(eq(schema.inspirationListItems.id, itemId))
    return { removed: true, id: itemId }
  }

  const tried = payload.tried !== undefined ? Boolean(payload.tried) : current.tried
  const tried_at = tried ? (current.tried_at ?? new Date().toISOString()) : null

  const [updated] = await db
    .update(schema.inspirationListItems)
    .set({ tried, tried_at })
    .where(eq(schema.inspirationListItems.id, itemId))
    .returning()

  return updated ?? { ...current, tried, tried_at }
}

async function createRecommendation(payload) {
  const fromUserId = getRequiredString(payload.from_user_id, 'el from_user_id')
  const toUserId = getRequiredString(payload.to_user_id, 'el to_user_id')
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')

  if (fromUserId === toUserId) {
    throw new Error('No puedes recomendarte a ti mismo.')
  }

  const [users, dishEntries, follows] = await Promise.all([
    FETCH.users(),
    FETCH.dishEntries(),
    FETCH.follows(),
  ])

  ensureRecordExists(users, fromUserId, 'el usuario origen')
  ensureRecordExists(users, toUserId, 'el usuario destino')
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración recomendada')

  if (!buildMutualFollowIds(follows, fromUserId).has(toUserId)) {
    throw new Error('Solo puedes enviar recomendaciones a amistades mutuas.')
  }

  const record = {
    id: randomUUID(),
    from_user_id: fromUserId,
    to_user_id: toUserId,
    dish_entry_id: dishEntryId,
    seen: false,
    created_at: new Date().toISOString(),
  }

  await db.insert(schema.recommendations).values(record)
  return record
}

async function markRecommendationSeen(recommendationId) {
  const recs = await FETCH.recommendations()
  ensureRecordExists(recs, recommendationId, 'la recomendación')

  const [updated] = await db
    .update(schema.recommendations)
    .set({ seen: true })
    .where(eq(schema.recommendations.id, recommendationId))
    .returning()

  return updated
}

async function getRecommendations(userId) {
  const [users, recs, dishEntries, follows] = await Promise.all([
    FETCH.users(),
    FETCH.recommendations(),
    FETCH.dishEntries(),
    FETCH.follows(),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const usersById = buildUserLookup(users)
  const entriesById = new Map(dishEntries.map((e) => [e.id, e]))
  const mutualFollowIds = buildMutualFollowIds(follows, userId)

  const inbox = recs
    .filter(
      (r) => r.to_user_id === userId && mutualFollowIds.has(r.from_user_id),
    )
    .map((r) => ({
      ...r,
      from_user: usersById.get(r.from_user_id) ?? null,
      to_user: usersById.get(r.to_user_id) ?? null,
      dish_entry: entriesById.get(r.dish_entry_id) ?? null,
    }))

  return {
    recommendations: inbox,
    unseen: inbox.filter((r) => !r.seen),
    unseen_count: inbox.filter((r) => !r.seen).length,
  }
}

async function createAchievement(payload) {
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const badgeType = getRequiredString(payload.badge_type, 'el badge_type')
  const notified = Boolean(payload.notified)

  if (!ACHIEVEMENT_TYPES.includes(badgeType)) {
    throw new Error('El badge_type no es válido.')
  }

  const [users, achievements] = await Promise.all([FETCH.users(), FETCH.achievements()])
  ensureRecordExists(users, userId, 'el usuario')

  const existing = achievements.find(
    (a) => a.user_id === userId && a.badge_type === badgeType,
  )

  if (existing) {
    return existing
  }

  const record = {
    id: randomUUID(),
    user_id: userId,
    badge_type: badgeType,
    unlocked_at: new Date().toISOString(),
    notified,
  }

  await db.insert(schema.achievements).values(record)
  return record
}

async function getAchievements(userId) {
  const [users, achievements, dishEntries] = await Promise.all([
    FETCH.users(),
    FETCH.achievements(),
    FETCH.dishEntries(),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')

  const userAchievements = achievements.filter((a) => a.user_id === userId)

  return {
    achievements: userAchievements,
    weekly_streak: calculateWeeklyStreak(dishEntries, userId),
    total_achievements: userAchievements.length,
  }
}

async function updateAchievement(achievementId, payload) {
  const achievements = await FETCH.achievements()
  ensureRecordExists(achievements, achievementId, 'el logro solicitado')

  const notified =
    payload.notified !== undefined
      ? Boolean(payload.notified)
      : achievements.find((a) => a.id === achievementId)?.notified ?? false

  const [updated] = await db
    .update(schema.achievements)
    .set({ notified })
    .where(eq(schema.achievements.id, achievementId))
    .returning()

  return updated
}

async function loadBootstrapData({ includeSocial = false } = {}) {
  const [
    users,
    groups,
    groupMembers,
    restaurants,
    categories,
    dishTypes,
    dishEntries,
    publicShareTokens,
  ] = await Promise.all([
    FETCH.users(),
    FETCH.groups(),
    FETCH.groupMembers(),
    FETCH.restaurants(),
    FETCH.categories(),
    FETCH.dishTypes(),
    FETCH.dishEntries(),
    FETCH.publicShareTokens(),
  ])

  let follows = [],
    reactions = [],
    comments = [],
    inspirationLists = [],
    inspirationListItems = [],
    recommendations = [],
    achievements = []

  if (includeSocial) {
    ;[
      follows,
      reactions,
      comments,
      inspirationLists,
      inspirationListItems,
      recommendations,
      achievements,
    ] = await Promise.all([
      FETCH.follows(),
      FETCH.reactions(),
      FETCH.comments(),
      FETCH.inspirationLists(),
      FETCH.inspirationListItems(),
      FETCH.recommendations(),
      FETCH.achievements(),
    ])
  }

  return {
    users,
    groups,
    groupMembers,
    restaurants: parseRestaurantRows(restaurants),
    categories,
    dishTypes,
    dishEntries,
    publicShareTokens,
    follows,
    reactions,
    comments,
    inspirationLists,
    inspirationListItems,
    recommendations,
    achievements,
  }
}

async function loadPublicSharePayload(token) {
  const tokens = await FETCH.publicShareTokens()
  const shareToken = tokens.find((t) => t.token === token)

  if (!shareToken) {
    throw new Error('No existe ningún enlace público con ese token.')
  }

  const bootstrap = await loadBootstrapData()
  let scopedEntries = []

  if (shareToken.context === 'mi_ranking') {
    scopedEntries = bootstrap.dishEntries.filter(
      (e) => e.created_by_user_id === shareToken.created_by_user_id,
    )
  } else if (shareToken.context === 'grupo') {
    scopedEntries = bootstrap.dishEntries.filter(
      (e) => e.group_id === shareToken.group_id,
    )
  } else {
    scopedEntries = bootstrap.dishEntries.filter((e) => e.visibility === 'public')
  }

  const restaurantIds = new Set(scopedEntries.map((e) => e.restaurant_id))
  const categoryIds = new Set(scopedEntries.map((e) => e.categoria_id))
  const dishTypeIds = new Set(scopedEntries.map((e) => e.tipo_plato_id))
  const userIds = new Set(scopedEntries.map((e) => e.created_by_user_id))
  userIds.add(shareToken.created_by_user_id)
  const groupIds = new Set(
    shareToken.group_id
      ? [shareToken.group_id]
      : scopedEntries.map((e) => e.group_id).filter(Boolean),
  )

  return {
    shareToken: {
      ...shareToken,
      filters: parseJsonValue(shareToken.filters_json, {}),
    },
    bootstrap: {
      users: bootstrap.users.filter((u) => userIds.has(u.id)),
      groups: bootstrap.groups.filter((g) => groupIds.has(g.id)),
      groupMembers: bootstrap.groupMembers.filter((m) => groupIds.has(m.group_id)),
      restaurants: bootstrap.restaurants.filter((r) => restaurantIds.has(r.id)),
      categories: bootstrap.categories.filter((c) => categoryIds.has(c.id)),
      dishTypes: bootstrap.dishTypes.filter((d) => dishTypeIds.has(d.id)),
      dishEntries: scopedEntries,
      publicShareTokens: [],
    },
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleRoute(url, response) {
  const { pathname, searchParams } = url

  if (pathname === '/api/health') {
    try {
      await db.execute('SELECT 1')
      return sendJson(response, 200, { ok: true, database: 'postgresql' })
    } catch {
      return sendJson(response, 503, { ok: false, error: 'Database unavailable.' })
    }
  }

  if (pathname === '/api/bootstrap') {
    const includeSocial =
      searchParams.get('include_social') === '1' ||
      searchParams.get('includeSocial') === '1'
    return sendJson(response, 200, await loadBootstrapData({ includeSocial }))
  }

  if (pathname.startsWith('/api/public-share/')) {
    const token = pathname.replace('/api/public-share/', '').trim()
    return sendJson(response, 200, await loadPublicSharePayload(token))
  }

  if (pathname === '/api/follows') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    return sendJson(response, 200, await getFollowState(userId))
  }

  if (pathname === '/api/community/feed') {
    return sendJson(response, 200, await getCommunityFeed(searchParams))
  }

  if (pathname.startsWith('/api/comments/')) {
    const entryId = decodeURIComponent(pathname.replace('/api/comments/', ''))
    return sendJson(response, 200, {
      comments: await getCommentsForEntry(entryId),
    })
  }

  if (pathname === '/api/inspiration-lists') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    return sendJson(response, 200, {
      inspirationLists: await getInspirationLists(userId),
    })
  }

  if (pathname === '/api/recommendations') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    return sendJson(response, 200, await getRecommendations(userId))
  }

  if (pathname === '/api/achievements') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    return sendJson(response, 200, await getAchievements(userId))
  }

  // Generic table reads
  const routeKey = pathname.replace('/api/', '')

  if (routeKey in FETCH) {
    const rows = await FETCH[routeKey]()
    const payload = routeKey === 'restaurants' ? parseRestaurantRows(rows) : rows
    return sendJson(response, 200, payload)
  }

  return sendJson(response, 404, { error: `Ruta no encontrada: ${pathname}` })
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    return sendJson(response, 400, { error: 'Petición inválida.' })
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    })
    response.end()
    return
  }

  if (enforceRateLimit(request, response)) {
    return
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`)

    if (request.method === 'GET') {
      await handleRoute(url, response)
      return
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      ensureJsonRequest(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/follows') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { follow: await createFollow(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/restaurants') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { restaurant: await createRestaurant(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/groups') {
      const body = await readJsonBody(request)
      sendJson(response, 201, await createGroup(body))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/categories') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { category: await createCategory(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-types') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { dishType: await createDishType(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-entries') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { dishEntry: await createDishEntry(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/reactions') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { reaction: await addOrUpdateReaction(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/comments') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { comment: await createComment(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-lists') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { inspirationList: await createInspirationList(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-list-items') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        inspirationListItem: await createInspirationListItem(body),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/recommendations') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { recommendation: await createRecommendation(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/achievements') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { achievement: await createAchievement(body) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/public-share-tokens') {
      const body = await readJsonBody(request)
      sendJson(response, 201, { shareToken: await createPublicShareToken(body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/users/')) {
      const body = await readJsonBody(request)
      const userId = decodeURIComponent(url.pathname.replace('/api/users/', ''))
      sendJson(response, 200, { user: await updateUser(userId, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/groups/')) {
      const body = await readJsonBody(request)
      const groupId = decodeURIComponent(url.pathname.replace('/api/groups/', ''))
      sendJson(response, 200, { group: await updateGroup(groupId, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/restaurants/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/restaurants/', ''))
      sendJson(response, 200, { restaurant: await updateRestaurant(id, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/categories/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/categories/', ''))
      sendJson(response, 200, { category: await updateCategory(id, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/dish-types/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/dish-types/', ''))
      sendJson(response, 200, { dishType: await updateDishType(id, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/dish-entries/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/dish-entries/', ''))
      sendJson(response, 200, { dishEntry: await updateDishEntry(id, body) })
      return
    }

    if (
      request.method === 'PUT' &&
      url.pathname.startsWith('/api/inspiration-list-items/')
    ) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(
        url.pathname.replace('/api/inspiration-list-items/', ''),
      )
      sendJson(response, 200, {
        inspirationListItem: await updateInspirationListItem(id, body),
      })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/recommendations/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/recommendations/', ''))
      sendJson(response, 200, { recommendation: await markRecommendationSeen(id) })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/achievements/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/achievements/', ''))
      sendJson(response, 200, { achievement: await updateAchievement(id, body) })
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/follows/')) {
      const followedUserId = decodeURIComponent(
        url.pathname.replace('/api/follows/', ''),
      )
      const currentUserId = getCurrentUserIdFromSearchParams(url.searchParams)
      sendJson(response, 200, await deleteFollow(currentUserId, followedUserId))
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/reactions/')) {
      const reactionId = decodeURIComponent(url.pathname.replace('/api/reactions/', ''))
      sendJson(response, 200, await deleteReaction(reactionId))
      return
    }

    return sendJson(response, 405, { error: 'Método no permitido.' })
  } catch (error) {
    return sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : 'Error interno del servidor.',
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`API escuchando en http://${HOST}:${PORT}`)
  console.log(`Base de datos: PostgreSQL (${process.env.DATABASE_URL ?? 'localhost:5432'})`)
})

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  validateCategoryPayload,
  validateDishEntryPayload,
  validateDishTypePayload,
  validateGroupPayload,
  validateRestaurantPayload,
  validateUserPayload,
} from '../src/lib/validation.js'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT ?? 3030)
const HOST = process.env.HOST ?? '0.0.0.0'
const MAX_REQUEST_BODY_BYTES = 80 * 1024 * 1024
const SQLITE_JSON_MAX_BUFFER_BYTES = 128 * 1024 * 1024
const DB_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), 'server/db/data/ranking_gastronomico.sqlite')

const ROUTE_QUERIES = {
  users: 'SELECT * FROM users ORDER BY created_at ASC;',
  groups: 'SELECT * FROM "groups" ORDER BY created_at ASC;',
  groupMembers: 'SELECT * FROM group_members ORDER BY joined_at ASC;',
  restaurants: 'SELECT * FROM restaurants ORDER BY created_at ASC;',
  categories: 'SELECT * FROM categories ORDER BY nombre ASC;',
  dishTypes: 'SELECT * FROM dish_types ORDER BY nombre ASC;',
  dishEntries: 'SELECT * FROM dish_entries ORDER BY created_at ASC;',
  publicShareTokens: 'SELECT * FROM public_share_tokens ORDER BY created_at ASC;',
  follows: 'SELECT * FROM follows ORDER BY created_at DESC;',
  reactions: 'SELECT * FROM reactions ORDER BY created_at DESC;',
  comments: 'SELECT * FROM comments ORDER BY created_at ASC;',
  inspirationLists: 'SELECT * FROM inspiration_lists ORDER BY created_at ASC;',
  inspirationListItems:
    'SELECT * FROM inspiration_list_items ORDER BY saved_at DESC;',
  recommendations: 'SELECT * FROM recommendations ORDER BY created_at DESC;',
  achievements: 'SELECT * FROM achievements ORDER BY unlocked_at DESC;',
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function parseJsonValue(value, fallback) {
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
  return rows.map((restaurant) => ({
    ...restaurant,
    tags:
      typeof restaurant.tags === 'string'
        ? JSON.parse(restaurant.tags)
        : restaurant.tags,
  }))
}

async function runJsonQuery(sql) {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `No existe la base SQLite en ${DB_PATH}. Ejecuta "npm run db:reset" antes de levantar la API.`,
    )
  }

  const { stdout } = await execFileAsync(
    'sqlite3',
    ['-readonly', '-cmd', '.mode json', DB_PATH, sql],
    {
      maxBuffer: SQLITE_JSON_MAX_BUFFER_BYTES,
    },
  )

  const trimmed = stdout.trim()
  return trimmed ? JSON.parse(trimmed) : []
}

async function runWriteQuery(sql) {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `No existe la base SQLite en ${DB_PATH}. Ejecuta "npm run db:reset" antes de levantar la API.`,
    )
  }

  await new Promise((resolve, reject) => {
    const child = spawn('sqlite3', ['-bail', DB_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || 'No se pudo ejecutar la escritura SQLite.'))
    })

    child.stdin.write(sql)
    child.stdin.end()
  })
}

function escapeSqlString(value) {
  return String(value).replaceAll("'", "''")
}

function generateInviteCode() {
  return randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
}

function generatePublicShareToken() {
  return randomUUID().replaceAll('-', '').slice(0, 16)
}

async function generateUniqueInviteCode() {
  const groups = await runJsonQuery(ROUTE_QUERIES.groups)
  const existingCodes = new Set(groups.map((group) => group.invite_code))

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const inviteCode = generateInviteCode()
    if (!existingCodes.has(inviteCode)) {
      return inviteCode
    }
  }

  throw new Error('No se pudo generar un código de invitación único.')
}

async function generateUniquePublicShareToken() {
  const shareTokens = await runJsonQuery(ROUTE_QUERIES.publicShareTokens)
  const existingTokens = new Set(shareTokens.map((token) => token.token))

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const token = generatePublicShareToken()
    if (!existingTokens.has(token)) {
      return token
    }
  }

  throw new Error('No se pudo generar un token público único.')
}

function calculateGeneralScore(entry) {
  const values = [
    entry.sabor,
    entry.textura,
    entry.presentacion,
    entry.calidad_precio,
  ].filter((value) => typeof value === 'number' && !Number.isNaN(value))

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(1))
}

function sqlValue(value) {
  return value === null || value === undefined ? 'NULL' : `'${escapeSqlString(value)}'`
}

function numericSqlValue(value) {
  return value === null || value === undefined ? 'NULL' : String(value)
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBooleanFlag(value, fallback = 0) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (value === 1 || value === '1' || value === 'true') {
    return 1
  }

  if (value === 0 || value === '0' || value === 'false') {
    return 0
  }

  return fallback
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
  const allowedTypes = [
    'quiero_probar',
    'ya_probe',
    'que_hambre',
    'mejorable',
    'paso',
  ]

  if (!allowedTypes.includes(reactionType)) {
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
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() - day + 1)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

function calculateWeeklyStreak(dishEntries, userId) {
  const userEntries = dishEntries.filter((entry) => entry.created_by_user_id === userId)

  if (userEntries.length === 0) {
    return 0
  }

  const entryWeeks = new Set(
    userEntries.map((entry) => getWeekStart(entry.created_at ?? entry.fecha).toISOString()),
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
  return new Map(users.map((user) => [user.id, user]))
}

function buildReactionSummary(reactions) {
  const summary = new Map()

  reactions.forEach((reaction) => {
    const currentCount = summary.get(reaction.reaction_type) ?? 0
    summary.set(reaction.reaction_type, currentCount + 1)
  })

  return Array.from(summary.entries())
    .map(([reactionType, count]) => ({ reaction_type: reactionType, count }))
    .sort((left, right) => right.count - left.count || left.reaction_type.localeCompare(right.reaction_type))
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
      entryReactions.find((reaction) => reaction.user_id === context.currentUserId) ?? null,
  }
}

function ensureRecordExists(rows, id, label) {
  const record = rows.find((row) => row.id === id)

  if (!record) {
    throw new Error(`No existe ${label}.`)
  }

  return record
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > MAX_REQUEST_BODY_BYTES) {
        reject(new Error('La petición es demasiado grande.'))
      }
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

async function createRestaurant(payload) {
  const restaurants = parseRestaurantRows(await runJsonQuery(ROUTE_QUERIES.restaurants))
  const normalizedPayload = validateRestaurantPayload(payload, restaurants)

  const record = {
    id: randomUUID(),
    nombre: normalizedPayload.nombre,
    nombre_normalizado: normalizedPayload.nombre_normalizado,
    direccion_texto: normalizedPayload.direccion_texto,
    google_maps_url:
      normalizedPayload.google_maps_url ||
      `https://maps.google.com/?q=${normalizedPayload.lat},${normalizedPayload.lng}`,
    lat: normalizedPayload.lat,
    lng: normalizedPayload.lng,
    precio_rango: normalizedPayload.precio_rango,
    tags: normalizedPayload.tags,
    notas: normalizedPayload.notas,
    created_at: new Date().toISOString(),
    created_by_user_id: normalizedPayload.created_by_user_id,
    cover_photo_url: normalizedPayload.cover_photo_url,
  }

  if (!record.created_by_user_id) {
    throw new Error('Falta el usuario creador del restaurante.')
  }

  const sql = `
    INSERT INTO restaurants (
      id,
      nombre,
      nombre_normalizado,
      direccion_texto,
      google_maps_url,
      lat,
      lng,
      precio_rango,
      tags,
      notas,
      created_at,
      created_by_user_id,
      cover_photo_url
    ) VALUES (
      '${escapeSqlString(record.id)}',
      '${escapeSqlString(record.nombre)}',
      '${escapeSqlString(record.nombre_normalizado)}',
      '${escapeSqlString(record.direccion_texto)}',
      '${escapeSqlString(record.google_maps_url)}',
      ${record.lat},
      ${record.lng},
      '${escapeSqlString(record.precio_rango)}',
      '${escapeSqlString(JSON.stringify(record.tags))}',
      '${escapeSqlString(record.notas)}',
      '${escapeSqlString(record.created_at)}',
      '${escapeSqlString(record.created_by_user_id)}',
      '${escapeSqlString(record.cover_photo_url)}'
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    tags: record.tags,
  }
}

async function createGroup(payload) {
  const normalizedPayload = validateGroupPayload(payload, {
    requireCreator: true,
  })
  const createdByUserId = normalizedPayload.created_by_user_id

  const createdAt = new Date().toISOString()
  const groupRecord = {
    id: randomUUID(),
    nombre: normalizedPayload.nombre,
    tipo: normalizedPayload.tipo,
    visibility: normalizedPayload.visibility,
    join_policy: normalizedPayload.join_policy,
    invite_code: await generateUniqueInviteCode(),
    created_by_user_id: createdByUserId,
    created_at: createdAt,
  }
  const groupMemberRecord = {
    id: randomUUID(),
    group_id: groupRecord.id,
    user_id: createdByUserId,
    role: 'owner',
    status: 'active',
    joined_at: createdAt,
  }

  const sql = `
    BEGIN TRANSACTION;
    INSERT INTO "groups" (
      id,
      nombre,
      tipo,
      visibility,
      join_policy,
      invite_code,
      created_by_user_id,
      created_at
    ) VALUES (
      '${escapeSqlString(groupRecord.id)}',
      '${escapeSqlString(groupRecord.nombre)}',
      '${escapeSqlString(groupRecord.tipo)}',
      '${escapeSqlString(groupRecord.visibility)}',
      '${escapeSqlString(groupRecord.join_policy)}',
      '${escapeSqlString(groupRecord.invite_code)}',
      '${escapeSqlString(groupRecord.created_by_user_id)}',
      '${escapeSqlString(groupRecord.created_at)}'
    );
    INSERT INTO group_members (
      id,
      group_id,
      user_id,
      role,
      status,
      joined_at
    ) VALUES (
      '${escapeSqlString(groupMemberRecord.id)}',
      '${escapeSqlString(groupMemberRecord.group_id)}',
      '${escapeSqlString(groupMemberRecord.user_id)}',
      '${escapeSqlString(groupMemberRecord.role)}',
      '${escapeSqlString(groupMemberRecord.status)}',
      '${escapeSqlString(groupMemberRecord.joined_at)}'
    );
    COMMIT;
  `

  await runWriteQuery(sql)

  return {
    group: groupRecord,
    groupMember: groupMemberRecord,
  }
}

async function createCategory(payload) {
  const existingCategories = await runJsonQuery(ROUTE_QUERIES.categories)
  const normalizedPayload = validateCategoryPayload(payload, existingCategories)

  const record = {
    id: randomUUID(),
    ...normalizedPayload,
  }

  const sql = `
    INSERT INTO categories (id, nombre, icono, scope, created_by_user_id)
    VALUES (
      '${escapeSqlString(record.id)}',
      '${escapeSqlString(record.nombre)}',
      '${escapeSqlString(record.icono)}',
      '${escapeSqlString(record.scope)}',
      ${sqlValue(record.created_by_user_id)}
    );
  `

  await runWriteQuery(sql)
  return record
}

async function createDishType(payload) {
  const existingDishTypes = await runJsonQuery(ROUTE_QUERIES.dishTypes)
  const normalizedPayload = validateDishTypePayload(payload, existingDishTypes)

  const record = {
    id: randomUUID(),
    ...normalizedPayload,
  }

  const sql = `
    INSERT INTO dish_types (
      id,
      categoria_id,
      nombre,
      alias,
      scope,
      created_by_user_id
    ) VALUES (
      '${escapeSqlString(record.id)}',
      '${escapeSqlString(record.categoria_id)}',
      '${escapeSqlString(record.nombre)}',
      ${sqlValue(record.alias)},
      '${escapeSqlString(record.scope)}',
      ${sqlValue(record.created_by_user_id)}
    );
  `

  await runWriteQuery(sql)
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
    filters_json: JSON.stringify(filters),
    group_id: groupId,
    created_by_user_id: createdByUserId,
    created_at: new Date().toISOString(),
    expires_at: null,
  }

  const sql = `
    INSERT INTO public_share_tokens (
      id,
      token,
      context,
      ranking_type,
      filters_json,
      group_id,
      created_by_user_id,
      created_at,
      expires_at
    ) VALUES (
      '${escapeSqlString(record.id)}',
      '${escapeSqlString(record.token)}',
      '${escapeSqlString(record.context)}',
      '${escapeSqlString(record.ranking_type)}',
      '${escapeSqlString(record.filters_json)}',
      ${record.group_id ? `'${escapeSqlString(record.group_id)}'` : 'NULL'},
      '${escapeSqlString(record.created_by_user_id)}',
      '${escapeSqlString(record.created_at)}',
      NULL
    );
  `

  await runWriteQuery(sql)

  return {
    ...record,
    filters: filters,
  }
}

async function createDishEntry(payload) {
  const dishEntries = await runJsonQuery(ROUTE_QUERIES.dishEntries)
  const normalizedPayload = validateDishEntryPayload(payload, dishEntries)

  const record = {
    id: randomUUID(),
    ...normalizedPayload,
    created_at: new Date().toISOString(),
  }

  const sql = `
    INSERT INTO dish_entries (
      id,
      restaurant_id,
      categoria_id,
      tipo_plato_id,
      nombre_plato,
      sabor,
      textura,
      presentacion,
      calidad_precio,
      precio_plato,
      notas,
      fecha,
      foto_url,
      created_by_user_id,
      group_id,
      visibility,
      created_at
    ) VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.restaurant_id)},
      ${sqlValue(record.categoria_id)},
      ${sqlValue(record.tipo_plato_id)},
      ${sqlValue(record.nombre_plato)},
      ${numericSqlValue(record.sabor)},
      ${numericSqlValue(record.textura)},
      ${numericSqlValue(record.presentacion)},
      ${numericSqlValue(record.calidad_precio)},
      ${numericSqlValue(record.precio_plato)},
      ${sqlValue(record.notas)},
      ${sqlValue(record.fecha)},
      ${sqlValue(record.foto_url)},
      ${sqlValue(record.created_by_user_id)},
      ${sqlValue(record.group_id)},
      ${sqlValue(record.visibility)},
      ${sqlValue(record.created_at)}
    );
  `

  await runWriteQuery(sql)

  return {
    ...record,
    puntuacion_general: calculateGeneralScore(record),
  }
}

async function updateUser(userId, payload) {
  const users = await runJsonQuery(ROUTE_QUERIES.users)
  ensureRecordExists(users, userId, 'el usuario solicitado')
  const normalizedPayload = validateUserPayload(payload)

  const sql = `
    UPDATE users
    SET
      nombre = '${escapeSqlString(normalizedPayload.nombre)}',
      avatar_url = ${sqlValue(normalizedPayload.avatar_url)}
    WHERE id = '${escapeSqlString(userId)}';
  `

  await runWriteQuery(sql)
  return ensureRecordExists(await runJsonQuery(ROUTE_QUERIES.users), userId, 'el usuario actualizado')
}

async function updateGroup(groupId, payload) {
  const groups = await runJsonQuery(ROUTE_QUERIES.groups)
  const currentGroup = ensureRecordExists(groups, groupId, 'el grupo solicitado')
  const normalizedPayload = validateGroupPayload({
    ...currentGroup,
    ...payload,
    created_by_user_id: currentGroup.created_by_user_id,
  })

  const sql = `
    UPDATE "groups"
    SET
      nombre = '${escapeSqlString(normalizedPayload.nombre)}',
      tipo = '${escapeSqlString(normalizedPayload.tipo)}',
      visibility = '${escapeSqlString(normalizedPayload.visibility)}',
      join_policy = '${escapeSqlString(normalizedPayload.join_policy)}'
    WHERE id = '${escapeSqlString(groupId)}';
  `

  await runWriteQuery(sql)
  return ensureRecordExists(await runJsonQuery(ROUTE_QUERIES.groups), groupId, 'el grupo actualizado')
}

async function updateRestaurant(restaurantId, payload) {
  const restaurants = parseRestaurantRows(await runJsonQuery(ROUTE_QUERIES.restaurants))
  const currentRestaurant = ensureRecordExists(
    restaurants,
    restaurantId,
    'el restaurante solicitado',
  )
  const normalizedPayload = validateRestaurantPayload(
    {
      ...currentRestaurant,
      ...payload,
      created_by_user_id: currentRestaurant.created_by_user_id,
    },
    restaurants,
    { excludeId: restaurantId },
  )

  const sql = `
    UPDATE restaurants
    SET
      nombre = '${escapeSqlString(normalizedPayload.nombre)}',
      nombre_normalizado = '${escapeSqlString(normalizedPayload.nombre_normalizado)}',
      direccion_texto = '${escapeSqlString(normalizedPayload.direccion_texto)}',
      google_maps_url = '${escapeSqlString(normalizedPayload.google_maps_url || `https://maps.google.com/?q=${normalizedPayload.lat},${normalizedPayload.lng}`)}',
      lat = ${normalizedPayload.lat},
      lng = ${normalizedPayload.lng},
      precio_rango = '${escapeSqlString(normalizedPayload.precio_rango)}',
      tags = '${escapeSqlString(JSON.stringify(normalizedPayload.tags))}',
      notas = '${escapeSqlString(normalizedPayload.notas)}',
      cover_photo_url = '${escapeSqlString(normalizedPayload.cover_photo_url)}'
    WHERE id = '${escapeSqlString(restaurantId)}';
  `

  await runWriteQuery(sql)
  const updatedRestaurants = parseRestaurantRows(await runJsonQuery(ROUTE_QUERIES.restaurants))
  return ensureRecordExists(updatedRestaurants, restaurantId, 'el restaurante actualizado')
}

async function updateCategory(categoryId, payload) {
  const categories = await runJsonQuery(ROUTE_QUERIES.categories)
  const currentCategory = ensureRecordExists(categories, categoryId, 'la categoría solicitada')
  const normalizedPayload = validateCategoryPayload(
    {
      ...currentCategory,
      ...payload,
      created_by_user_id: currentCategory.created_by_user_id,
    },
    categories,
    { excludeId: categoryId },
  )

  const sql = `
    UPDATE categories
    SET
      nombre = '${escapeSqlString(normalizedPayload.nombre)}',
      icono = '${escapeSqlString(normalizedPayload.icono)}',
      scope = '${escapeSqlString(normalizedPayload.scope)}'
    WHERE id = '${escapeSqlString(categoryId)}';
  `

  await runWriteQuery(sql)
  return ensureRecordExists(await runJsonQuery(ROUTE_QUERIES.categories), categoryId, 'la categoría actualizada')
}

async function updateDishType(dishTypeId, payload) {
  const dishTypes = await runJsonQuery(ROUTE_QUERIES.dishTypes)
  const currentDishType = ensureRecordExists(
    dishTypes,
    dishTypeId,
    'el tipo de plato solicitado',
  )
  const normalizedPayload = validateDishTypePayload(
    {
      ...currentDishType,
      ...payload,
      created_by_user_id: currentDishType.created_by_user_id,
    },
    dishTypes,
    { excludeId: dishTypeId },
  )

  const sql = `
    UPDATE dish_types
    SET
      categoria_id = '${escapeSqlString(normalizedPayload.categoria_id)}',
      nombre = '${escapeSqlString(normalizedPayload.nombre)}',
      alias = ${sqlValue(normalizedPayload.alias)},
      scope = '${escapeSqlString(normalizedPayload.scope)}'
    WHERE id = '${escapeSqlString(dishTypeId)}';
  `

  await runWriteQuery(sql)
  return ensureRecordExists(await runJsonQuery(ROUTE_QUERIES.dishTypes), dishTypeId, 'el tipo de plato actualizado')
}

async function updateDishEntry(dishEntryId, payload) {
  const dishEntries = await runJsonQuery(ROUTE_QUERIES.dishEntries)
  const currentDishEntry = ensureRecordExists(
    dishEntries,
    dishEntryId,
    'la valoración solicitada',
  )
  const normalizedPayload = validateDishEntryPayload(
    {
      ...currentDishEntry,
      ...payload,
      created_by_user_id: currentDishEntry.created_by_user_id,
    },
    dishEntries,
    { excludeId: dishEntryId },
  )

  const sql = `
    UPDATE dish_entries
    SET
      restaurant_id = ${sqlValue(normalizedPayload.restaurant_id)},
      categoria_id = ${sqlValue(normalizedPayload.categoria_id)},
      tipo_plato_id = ${sqlValue(normalizedPayload.tipo_plato_id)},
      nombre_plato = ${sqlValue(normalizedPayload.nombre_plato)},
      sabor = ${numericSqlValue(normalizedPayload.sabor)},
      textura = ${numericSqlValue(normalizedPayload.textura)},
      presentacion = ${numericSqlValue(normalizedPayload.presentacion)},
      calidad_precio = ${numericSqlValue(normalizedPayload.calidad_precio)},
      precio_plato = ${numericSqlValue(normalizedPayload.precio_plato)},
      notas = ${sqlValue(normalizedPayload.notas)},
      fecha = ${sqlValue(normalizedPayload.fecha)},
      foto_url = ${sqlValue(normalizedPayload.foto_url)},
      group_id = ${sqlValue(normalizedPayload.group_id)},
      visibility = ${sqlValue(normalizedPayload.visibility)}
    WHERE id = ${sqlValue(dishEntryId)};
  `

  await runWriteQuery(sql)
  const updatedDishEntry = ensureRecordExists(
    await runJsonQuery(ROUTE_QUERIES.dishEntries),
    dishEntryId,
    'la valoración actualizada',
  )

  return {
    ...updatedDishEntry,
    puntuacion_general:
      typeof updatedDishEntry.puntuacion_general === 'number'
        ? updatedDishEntry.puntuacion_general
        : calculateGeneralScore(updatedDishEntry),
  }
}

async function getFollowState(userId) {
  const [users, follows] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.follows),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const usersById = buildUserLookup(users)
  const following = follows.filter((follow) => follow.follower_user_id === userId)
  const followers = follows.filter((follow) => follow.followed_user_id === userId)
  const followingIds = new Set(following.map((follow) => follow.followed_user_id))
  const followerIds = new Set(followers.map((follow) => follow.follower_user_id))
  const mutualIds = Array.from(followingIds).filter((followedUserId) => followerIds.has(followedUserId))

  return {
    follows: follows.filter(
      (follow) =>
        follow.follower_user_id === userId || follow.followed_user_id === userId,
    ),
    following: following.map((follow) => ({
      ...follow,
      user: usersById.get(follow.followed_user_id) ?? null,
      id: follow.followed_user_id,
    })),
    followers: followers.map((follow) => ({
      ...follow,
      user: usersById.get(follow.follower_user_id) ?? null,
      id: follow.follower_user_id,
    })),
    mutuals: mutualIds.map((mutualUserId) => usersById.get(mutualUserId)).filter(Boolean),
  }
}

async function createFollow(payload) {
  const followerUserId = getRequiredString(
    payload.follower_user_id ?? payload.current_user_id ?? payload.user_id,
    'el follower_user_id',
  )
  const followedUserId = getRequiredString(
    payload.followed_user_id,
    'el followed_user_id',
  )

  if (followerUserId === followedUserId) {
    throw new Error('No puedes seguirte a ti mismo.')
  }

  const [users, follows] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.follows),
  ])

  ensureRecordExists(users, followerUserId, 'el usuario seguidor')
  ensureRecordExists(users, followedUserId, 'el usuario a seguir')

  const existingFollow = follows.find(
    (follow) =>
      follow.follower_user_id === followerUserId &&
      follow.followed_user_id === followedUserId,
  )

  if (existingFollow) {
    return existingFollow
  }

  const record = {
    follower_user_id: followerUserId,
    followed_user_id: followedUserId,
    created_at: new Date().toISOString(),
  }

  const sql = `
    INSERT INTO follows (follower_user_id, followed_user_id, created_at)
    VALUES (
      ${sqlValue(record.follower_user_id)},
      ${sqlValue(record.followed_user_id)},
      ${sqlValue(record.created_at)}
    );
  `

  await runWriteQuery(sql)
  return record
}

async function deleteFollow(currentUserId, followedUserId) {
  const follows = await runJsonQuery(ROUTE_QUERIES.follows)
  const follow = follows.find(
    (item) =>
      item.follower_user_id === currentUserId &&
      item.followed_user_id === followedUserId,
  )

  if (!follow) {
    throw new Error('No existe ese follow.')
  }

  const sql = `
    DELETE FROM follows
    WHERE follower_user_id = ${sqlValue(currentUserId)}
      AND followed_user_id = ${sqlValue(followedUserId)};
  `

  await runWriteQuery(sql)
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
    reactions,
    comments,
  ] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.restaurants),
    runJsonQuery(ROUTE_QUERIES.categories),
    runJsonQuery(ROUTE_QUERIES.dishTypes),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
    runJsonQuery(ROUTE_QUERIES.follows),
    runJsonQuery(ROUTE_QUERIES.reactions),
    runJsonQuery(ROUTE_QUERIES.comments),
  ])

  ensureRecordExists(users, currentUserId, 'el usuario actual')

  const followingIds = new Set(
    follows
      .filter((follow) => follow.follower_user_id === currentUserId)
      .map((follow) => follow.followed_user_id),
  )
  const followerIds = new Set(
    follows
      .filter((follow) => follow.followed_user_id === currentUserId)
      .map((follow) => follow.follower_user_id),
  )
  const mutualFollowIds = new Set(
    Array.from(followingIds).filter((followedUserId) => followerIds.has(followedUserId)),
  )
  const restaurantsById = new Map(parseRestaurantRows(restaurants).map((restaurant) => [restaurant.id, restaurant]))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const dishTypesById = new Map(dishTypes.map((dishType) => [dishType.id, dishType]))
  const usersById = buildUserLookup(users)
  const reactionsByEntryId = new Map()
  const commentsByEntryId = new Map()

  reactions.forEach((reaction) => {
    const entryReactions = reactionsByEntryId.get(reaction.dish_entry_id) ?? []
    entryReactions.push(reaction)
    reactionsByEntryId.set(reaction.dish_entry_id, entryReactions)
  })

  comments.forEach((comment) => {
    const entryComments = commentsByEntryId.get(comment.dish_entry_id) ?? []
    entryComments.push({
      ...comment,
      mentions: parseJsonValue(comment.mentions, []),
    })
    commentsByEntryId.set(comment.dish_entry_id, entryComments)
  })

  let scopedEntries = dishEntries.filter((entry) => entry.created_by_user_id !== currentUserId)

  if (tab === 'amigos') {
    scopedEntries = scopedEntries.filter(
      (entry) =>
        mutualFollowIds.has(entry.created_by_user_id) && entry.visibility !== 'private',
    )
  } else {
    scopedEntries = scopedEntries.filter((entry) => entry.visibility === 'public')
  }

  if (filters.categoryIds.length > 0) {
    scopedEntries = scopedEntries.filter((entry) => filters.categoryIds.includes(entry.categoria_id))
  }

  if (filters.dishTypeIds.length > 0) {
    scopedEntries = scopedEntries.filter((entry) => filters.dishTypeIds.includes(entry.tipo_plato_id))
  }

  if (filters.priceRange.length > 0) {
    scopedEntries = scopedEntries.filter((entry) => {
      const restaurant = restaurantsById.get(entry.restaurant_id)
      return restaurant && filters.priceRange.includes(restaurant.precio_rango)
    })
  }

  if (typeof filters.minScore === 'number' && !Number.isNaN(filters.minScore)) {
    scopedEntries = scopedEntries.filter(
      (entry) => Number(entry.puntuacion_general ?? 0) >= filters.minScore,
    )
  }

  if (filters.dateFrom) {
    scopedEntries = scopedEntries.filter((entry) => String(entry.fecha) >= filters.dateFrom)
  }

  if (filters.dateTo) {
    scopedEntries = scopedEntries.filter((entry) => String(entry.fecha) <= filters.dateTo)
  }

  scopedEntries.sort((left, right) => {
    const leftTime = new Date(left.created_at ?? left.fecha).getTime()
    const rightTime = new Date(right.created_at ?? right.fecha).getTime()
    return rightTime - leftTime
  })

  const totalItems = scopedEntries.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize
  const paginatedEntries = scopedEntries.slice(offset, offset + pageSize)
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
    entries: paginatedEntries.map((entry) => buildCommunityEntry(entry, context)),
  }
}

async function addOrUpdateReaction(payload) {
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const reactionType = normalizeReactionType(payload.reaction_type)

  const [dishEntries, users, reactions] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.dishEntries),
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.reactions),
  ])

  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')
  ensureRecordExists(users, userId, 'el usuario')

  const existingReaction = reactions.find(
    (reaction) => reaction.dish_entry_id === dishEntryId && reaction.user_id === userId,
  )
  const createdAt = existingReaction?.created_at ?? new Date().toISOString()
  const record = {
    id: existingReaction?.id ?? randomUUID(),
    dish_entry_id: dishEntryId,
    user_id: userId,
    reaction_type: reactionType,
    created_at: createdAt,
  }

  const sql = existingReaction
    ? `
      UPDATE reactions
      SET reaction_type = ${sqlValue(record.reaction_type)}
      WHERE id = ${sqlValue(record.id)};
    `
    : `
      INSERT INTO reactions (id, dish_entry_id, user_id, reaction_type, created_at)
      VALUES (
        ${sqlValue(record.id)},
        ${sqlValue(record.dish_entry_id)},
        ${sqlValue(record.user_id)},
        ${sqlValue(record.reaction_type)},
        ${sqlValue(record.created_at)}
      );
    `

  await runWriteQuery(sql)
  return record
}

async function deleteReaction(reactionId) {
  const reactions = await runJsonQuery(ROUTE_QUERIES.reactions)
  ensureRecordExists(reactions, reactionId, 'la reacción')

  const sql = `
    DELETE FROM reactions
    WHERE id = ${sqlValue(reactionId)};
  `

  await runWriteQuery(sql)
  return { ok: true }
}

async function getCommentsForEntry(entryId) {
  const [comments, users, dishEntries] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.comments),
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
  ])

  ensureRecordExists(dishEntries, entryId, 'la valoración')
  const usersById = buildUserLookup(users)

  return comments
    .filter((comment) => comment.dish_entry_id === entryId)
    .map((comment) => ({
      ...comment,
      mentions: parseJsonValue(comment.mentions, []),
      user: usersById.get(comment.user_id) ?? null,
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

  const [dishEntries, users] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.dishEntries),
    runJsonQuery(ROUTE_QUERIES.users),
  ])

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

  const sql = `
    INSERT INTO comments (id, dish_entry_id, user_id, text, mentions, created_at)
    VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.dish_entry_id)},
      ${sqlValue(record.user_id)},
      ${sqlValue(record.text)},
      ${sqlValue(JSON.stringify(record.mentions))},
      ${sqlValue(record.created_at)}
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    user: ensureRecordExists(users, userId, 'el usuario del comentario'),
  }
}

async function getInspirationLists(userId) {
  const [users, lists, items, dishEntries] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.inspirationLists),
    runJsonQuery(ROUTE_QUERIES.inspirationListItems),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const entriesById = new Map(dishEntries.map((entry) => [entry.id, entry]))

  return lists
    .filter((list) => list.user_id === userId)
    .map((list) => {
      const listItems = items
        .filter((item) => item.list_id === list.id)
        .map((item) => ({
          ...item,
          tried: Boolean(item.tried),
          dish_entry: entriesById.get(item.dish_entry_id) ?? null,
        }))

      return {
        ...list,
        is_default: Boolean(list.is_default),
        items: listItems,
        items_count: listItems.length,
      }
    })
}

async function createInspirationList(payload) {
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const name = getRequiredString(payload.name, 'el nombre de la lista')
  const isDefault = toBooleanFlag(payload.is_default, 0)

  const [users, lists] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.inspirationLists),
  ])

  ensureRecordExists(users, userId, 'el usuario')

  if (
    lists.some(
      (list) =>
        list.user_id === userId &&
        list.name.trim().toLowerCase() === name.trim().toLowerCase(),
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

  const sql = `
    INSERT INTO inspiration_lists (id, user_id, name, is_default, created_at)
    VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.user_id)},
      ${sqlValue(record.name)},
      ${numericSqlValue(record.is_default)},
      ${sqlValue(record.created_at)}
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    is_default: Boolean(record.is_default),
  }
}

async function createInspirationListItem(payload) {
  const listId = getRequiredString(payload.list_id, 'el list_id')
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const tried = toBooleanFlag(payload.tried, 0)
  const now = new Date().toISOString()

  const [lists, dishEntries, items] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.inspirationLists),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
    runJsonQuery(ROUTE_QUERIES.inspirationListItems),
  ])

  ensureRecordExists(lists, listId, 'la lista')
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')

  const existingItem = items.find(
    (item) => item.list_id === listId && item.dish_entry_id === dishEntryId,
  )

  if (existingItem) {
    return {
      ...existingItem,
      tried: Boolean(existingItem.tried),
    }
  }

  const record = {
    id: randomUUID(),
    list_id: listId,
    dish_entry_id: dishEntryId,
    tried,
    tried_at: tried ? now : null,
    saved_at: now,
  }

  const sql = `
    INSERT INTO inspiration_list_items (
      id,
      list_id,
      dish_entry_id,
      tried,
      tried_at,
      saved_at
    ) VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.list_id)},
      ${sqlValue(record.dish_entry_id)},
      ${numericSqlValue(record.tried)},
      ${sqlValue(record.tried_at)},
      ${sqlValue(record.saved_at)}
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    tried: Boolean(record.tried),
  }
}

async function updateInspirationListItem(itemId, payload) {
  const items = await runJsonQuery(ROUTE_QUERIES.inspirationListItems)
  const currentItem = ensureRecordExists(items, itemId, 'el elemento de lista')

  if (toBooleanFlag(payload.remove, 0) === 1) {
    const sql = `
      DELETE FROM inspiration_list_items
      WHERE id = ${sqlValue(itemId)};
    `

    await runWriteQuery(sql)
    return { removed: true, id: itemId }
  }

  const tried = toBooleanFlag(payload.tried, currentItem.tried)
  const triedAt =
    tried === 1
      ? currentItem.tried_at ?? new Date().toISOString()
      : null

  const sql = `
    UPDATE inspiration_list_items
    SET
      tried = ${numericSqlValue(tried)},
      tried_at = ${sqlValue(triedAt)}
    WHERE id = ${sqlValue(itemId)};
  `

  await runWriteQuery(sql)
  return {
    ...currentItem,
    tried: Boolean(tried),
    tried_at: triedAt,
  }
}

async function createRecommendation(payload) {
  const fromUserId = getRequiredString(payload.from_user_id, 'el from_user_id')
  const toUserId = getRequiredString(payload.to_user_id, 'el to_user_id')
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')

  if (fromUserId === toUserId) {
    throw new Error('No puedes recomendarte a ti mismo.')
  }

  const [users, dishEntries] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
  ])

  ensureRecordExists(users, fromUserId, 'el usuario origen')
  ensureRecordExists(users, toUserId, 'el usuario destino')
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración recomendada')

  const record = {
    id: randomUUID(),
    from_user_id: fromUserId,
    to_user_id: toUserId,
    dish_entry_id: dishEntryId,
    seen: 0,
    created_at: new Date().toISOString(),
  }

  const sql = `
    INSERT INTO recommendations (
      id,
      from_user_id,
      to_user_id,
      dish_entry_id,
      seen,
      created_at
    ) VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.from_user_id)},
      ${sqlValue(record.to_user_id)},
      ${sqlValue(record.dish_entry_id)},
      ${numericSqlValue(record.seen)},
      ${sqlValue(record.created_at)}
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    seen: false,
  }
}

async function markRecommendationSeen(recommendationId) {
  const recommendations = await runJsonQuery(ROUTE_QUERIES.recommendations)
  const currentRecommendation = ensureRecordExists(
    recommendations,
    recommendationId,
    'la recomendación',
  )

  const sql = `
    UPDATE recommendations
    SET seen = 1
    WHERE id = ${sqlValue(recommendationId)};
  `

  await runWriteQuery(sql)
  return {
    ...currentRecommendation,
    seen: true,
  }
}

async function getRecommendations(userId) {
  const [users, recommendations, dishEntries] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.recommendations),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const usersById = buildUserLookup(users)
  const entriesById = new Map(dishEntries.map((entry) => [entry.id, entry]))
  const inbox = recommendations
    .filter((recommendation) => recommendation.to_user_id === userId)
    .map((recommendation) => ({
      ...recommendation,
      seen: Boolean(recommendation.seen),
      from_user: usersById.get(recommendation.from_user_id) ?? null,
      to_user: usersById.get(recommendation.to_user_id) ?? null,
      dish_entry: entriesById.get(recommendation.dish_entry_id) ?? null,
    }))

  return {
    recommendations: inbox,
    unseen: inbox.filter((recommendation) => !recommendation.seen),
    unseen_count: inbox.filter((recommendation) => !recommendation.seen).length,
  }
}

async function createAchievement(payload) {
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const badgeType = getRequiredString(payload.badge_type, 'el badge_type')
  const notified = toBooleanFlag(payload.notified, 0)
  const allowedBadgeTypes = [
    'primer_plato',
    'cinco_platos',
    'diez_platos',
    'primer_restaurante',
    'cinco_restaurantes',
    'catador_social',
    'explorador',
    'racha_semanal',
    'top_score',
    'coleccionista_inspo',
  ]

  if (!allowedBadgeTypes.includes(badgeType)) {
    throw new Error('El badge_type no es válido.')
  }

  const [users, achievements] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.achievements),
  ])

  ensureRecordExists(users, userId, 'el usuario')
  const existingAchievement = achievements.find(
    (achievement) =>
      achievement.user_id === userId && achievement.badge_type === badgeType,
  )

  if (existingAchievement) {
    return {
      ...existingAchievement,
      notified: Boolean(existingAchievement.notified),
    }
  }

  const record = {
    id: randomUUID(),
    user_id: userId,
    badge_type: badgeType,
    unlocked_at: new Date().toISOString(),
    notified,
  }

  const sql = `
    INSERT INTO achievements (id, user_id, badge_type, unlocked_at, notified)
    VALUES (
      ${sqlValue(record.id)},
      ${sqlValue(record.user_id)},
      ${sqlValue(record.badge_type)},
      ${sqlValue(record.unlocked_at)},
      ${numericSqlValue(record.notified)}
    );
  `

  await runWriteQuery(sql)
  return {
    ...record,
    notified: Boolean(record.notified),
  }
}

async function getAchievements(userId) {
  const [users, achievements, dishEntries] = await Promise.all([
    runJsonQuery(ROUTE_QUERIES.users),
    runJsonQuery(ROUTE_QUERIES.achievements),
    runJsonQuery(ROUTE_QUERIES.dishEntries),
  ])

  ensureRecordExists(users, userId, 'el usuario solicitado')
  const userAchievements = achievements
    .filter((achievement) => achievement.user_id === userId)
    .map((achievement) => ({
      ...achievement,
      notified: Boolean(achievement.notified),
    }))

  return {
    achievements: userAchievements,
    weekly_streak: calculateWeeklyStreak(dishEntries, userId),
    total_achievements: userAchievements.length,
  }
}

async function loadPublicSharePayload(token) {
  const shareTokens = await runJsonQuery(ROUTE_QUERIES.publicShareTokens)
  const shareToken = shareTokens.find((item) => item.token === token)

  if (!shareToken) {
    throw new Error('No existe ningún enlace público con ese token.')
  }

  const bootstrap = await loadBootstrap()
  let scopedEntries = []

  if (shareToken.context === 'mi_ranking') {
    scopedEntries = bootstrap.dishEntries.filter(
      (entry) => entry.created_by_user_id === shareToken.created_by_user_id,
    )
  } else if (shareToken.context === 'grupo') {
    scopedEntries = bootstrap.dishEntries.filter(
      (entry) => entry.group_id === shareToken.group_id,
    )
  } else {
    scopedEntries = bootstrap.dishEntries.filter(
      (entry) => entry.visibility === 'public',
    )
  }

  const restaurantIds = new Set(scopedEntries.map((entry) => entry.restaurant_id))
  const categoryIds = new Set(scopedEntries.map((entry) => entry.categoria_id))
  const dishTypeIds = new Set(scopedEntries.map((entry) => entry.tipo_plato_id))
  const userIds = new Set(scopedEntries.map((entry) => entry.created_by_user_id))
  userIds.add(shareToken.created_by_user_id)
  const groupIds = new Set(
    shareToken.group_id ? [shareToken.group_id] : scopedEntries.map((entry) => entry.group_id).filter(Boolean),
  )

  return {
    shareToken: {
      ...shareToken,
      filters: parseJsonValue(shareToken.filters_json, {}),
    },
    bootstrap: {
      users: bootstrap.users.filter((user) => userIds.has(user.id)),
      groups: bootstrap.groups.filter((group) => groupIds.has(group.id)),
      groupMembers: bootstrap.groupMembers.filter((member) => groupIds.has(member.group_id)),
      restaurants: bootstrap.restaurants.filter((restaurant) => restaurantIds.has(restaurant.id)),
      categories: bootstrap.categories.filter((category) => categoryIds.has(category.id)),
      dishTypes: bootstrap.dishTypes.filter((dishType) => dishTypeIds.has(dishType.id)),
      dishEntries: scopedEntries,
      publicShareTokens: [],
    },
  }
}

async function loadBootstrap() {
  const [
    users,
    groups,
    groupMembers,
    restaurants,
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
  ] = await Promise.all(
    Object.values(ROUTE_QUERIES).map((sql) => runJsonQuery(sql)),
  )

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
    comments: comments.map((comment) => ({
      ...comment,
      mentions: parseJsonValue(comment.mentions, []),
    })),
    inspirationLists: inspirationLists.map((list) => ({
      ...list,
      is_default: Boolean(list.is_default),
    })),
    inspirationListItems: inspirationListItems.map((item) => ({
      ...item,
      tried: Boolean(item.tried),
    })),
    recommendations: recommendations.map((recommendation) => ({
      ...recommendation,
      seen: Boolean(recommendation.seen),
    })),
    achievements: achievements.map((achievement) => ({
      ...achievement,
      notified: Boolean(achievement.notified),
    })),
  }
}

async function handleRoute(url, response) {
  const { pathname, searchParams } = url

  if (pathname === '/api/health') {
    return sendJson(response, 200, {
      ok: true,
      databasePath: DB_PATH,
      databaseReady: existsSync(DB_PATH),
    })
  }

  if (pathname === '/api/bootstrap') {
    const payload = await loadBootstrap()
    return sendJson(response, 200, payload)
  }

  if (pathname.startsWith('/api/public-share/')) {
    const token = pathname.replace('/api/public-share/', '').trim()
    const payload = await loadPublicSharePayload(token)
    return sendJson(response, 200, payload)
  }

  if (pathname === '/api/follows') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    const payload = await getFollowState(userId)
    return sendJson(response, 200, payload)
  }

  if (pathname === '/api/community/feed') {
    const payload = await getCommunityFeed(searchParams)
    return sendJson(response, 200, payload)
  }

  if (pathname.startsWith('/api/comments/')) {
    const entryId = decodeURIComponent(pathname.replace('/api/comments/', ''))
    const comments = await getCommentsForEntry(entryId)
    return sendJson(response, 200, { comments })
  }

  if (pathname === '/api/inspiration-lists') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    const inspirationLists = await getInspirationLists(userId)
    return sendJson(response, 200, { inspirationLists })
  }

  if (pathname === '/api/recommendations') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    const payload = await getRecommendations(userId)
    return sendJson(response, 200, payload)
  }

  if (pathname === '/api/achievements') {
    const userId = getCurrentUserIdFromSearchParams(searchParams)
    const payload = await getAchievements(userId)
    return sendJson(response, 200, payload)
  }

  const routeKey = pathname.replace('/api/', '')
  if (routeKey in ROUTE_QUERIES) {
    const rows = await runJsonQuery(ROUTE_QUERIES[routeKey])
    const payload = routeKey === 'restaurants' ? parseRestaurantRows(rows) : rows
    return sendJson(response, 200, payload)
  }

  return sendJson(response, 404, {
    error: `Ruta no encontrada: ${pathname}`,
  })
}

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

  try {
    const url = new URL(request.url, `http://${request.headers.host}`)

    if (request.method === 'GET') {
      await handleRoute(url, response)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/follows') {
      const body = await readJsonBody(request)
      const follow = await createFollow(body)
      sendJson(response, 201, { follow })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/restaurants') {
      const body = await readJsonBody(request)
      const restaurant = await createRestaurant(body)
      sendJson(response, 201, { restaurant })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/groups') {
      const body = await readJsonBody(request)
      const result = await createGroup(body)
      sendJson(response, 201, result)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/categories') {
      const body = await readJsonBody(request)
      const category = await createCategory(body)
      sendJson(response, 201, { category })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-types') {
      const body = await readJsonBody(request)
      const dishType = await createDishType(body)
      sendJson(response, 201, { dishType })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-entries') {
      const body = await readJsonBody(request)
      const dishEntry = await createDishEntry(body)
      sendJson(response, 201, { dishEntry })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/reactions') {
      const body = await readJsonBody(request)
      const reaction = await addOrUpdateReaction(body)
      sendJson(response, 201, { reaction })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/comments') {
      const body = await readJsonBody(request)
      const comment = await createComment(body)
      sendJson(response, 201, { comment })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-lists') {
      const body = await readJsonBody(request)
      const inspirationList = await createInspirationList(body)
      sendJson(response, 201, { inspirationList })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-list-items') {
      const body = await readJsonBody(request)
      const inspirationListItem = await createInspirationListItem(body)
      sendJson(response, 201, { inspirationListItem })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/recommendations') {
      const body = await readJsonBody(request)
      const recommendation = await createRecommendation(body)
      sendJson(response, 201, { recommendation })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/achievements') {
      const body = await readJsonBody(request)
      const achievement = await createAchievement(body)
      sendJson(response, 201, { achievement })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/public-share-tokens') {
      const body = await readJsonBody(request)
      const shareToken = await createPublicShareToken(body)
      sendJson(response, 201, { shareToken })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/users/')) {
      const body = await readJsonBody(request)
      const userId = decodeURIComponent(url.pathname.replace('/api/users/', ''))
      const user = await updateUser(userId, body)
      sendJson(response, 200, { user })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/groups/')) {
      const body = await readJsonBody(request)
      const groupId = decodeURIComponent(url.pathname.replace('/api/groups/', ''))
      const group = await updateGroup(groupId, body)
      sendJson(response, 200, { group })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/restaurants/')) {
      const body = await readJsonBody(request)
      const restaurantId = decodeURIComponent(
        url.pathname.replace('/api/restaurants/', ''),
      )
      const restaurant = await updateRestaurant(restaurantId, body)
      sendJson(response, 200, { restaurant })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/categories/')) {
      const body = await readJsonBody(request)
      const categoryId = decodeURIComponent(
        url.pathname.replace('/api/categories/', ''),
      )
      const category = await updateCategory(categoryId, body)
      sendJson(response, 200, { category })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/dish-types/')) {
      const body = await readJsonBody(request)
      const dishTypeId = decodeURIComponent(
        url.pathname.replace('/api/dish-types/', ''),
      )
      const dishType = await updateDishType(dishTypeId, body)
      sendJson(response, 200, { dishType })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/dish-entries/')) {
      const body = await readJsonBody(request)
      const dishEntryId = decodeURIComponent(
        url.pathname.replace('/api/dish-entries/', ''),
      )
      const dishEntry = await updateDishEntry(dishEntryId, body)
      sendJson(response, 200, { dishEntry })
      return
    }

    if (
      request.method === 'PUT' &&
      url.pathname.startsWith('/api/inspiration-list-items/')
    ) {
      const body = await readJsonBody(request)
      const itemId = decodeURIComponent(
        url.pathname.replace('/api/inspiration-list-items/', ''),
      )
      const inspirationListItem = await updateInspirationListItem(itemId, body)
      sendJson(response, 200, { inspirationListItem })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/recommendations/')) {
      const recommendationId = decodeURIComponent(
        url.pathname.replace('/api/recommendations/', ''),
      )
      const recommendation = await markRecommendationSeen(recommendationId)
      sendJson(response, 200, { recommendation })
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/follows/')) {
      const followedUserId = decodeURIComponent(url.pathname.replace('/api/follows/', ''))
      const currentUserId = getCurrentUserIdFromSearchParams(url.searchParams)
      const result = await deleteFollow(currentUserId, followedUserId)
      sendJson(response, 200, result)
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/reactions/')) {
      const reactionId = decodeURIComponent(url.pathname.replace('/api/reactions/', ''))
      const result = await deleteReaction(reactionId)
      sendJson(response, 200, result)
      return
    }

    return sendJson(response, 405, { error: 'Método no permitido.' })
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Error interno del servidor.',
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`API SQLite escuchando en http://${HOST}:${PORT}`)
  console.log(`Base activa: ${DB_PATH}`)
})

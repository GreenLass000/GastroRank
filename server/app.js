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
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
  }
}

async function handleRoute(pathname, response) {
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    })
    response.end()
    return
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`)

    if (request.method === 'GET') {
      await handleRoute(url.pathname, response)
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

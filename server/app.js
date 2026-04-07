import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT ?? 3030)
const HOST = process.env.HOST ?? '0.0.0.0'
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
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
      maxBuffer: 1024 * 1024 * 8,
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

  await execFileAsync('sqlite3', [DB_PATH, sql], {
    maxBuffer: 1024 * 1024 * 8,
  })
}

function normalizeName(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function escapeSqlString(value) {
  return String(value).replaceAll("'", "''")
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

function distanceInMeters(lat1, lng1, lat2, lng2) {
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

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 1024 * 1024) {
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
  const nombre = payload.nombre?.trim()
  const lat = Number(payload.lat)
  const lng = Number(payload.lng)

  if (!nombre) {
    throw new Error('El nombre del restaurante es obligatorio.')
  }

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error(
      'La ubicación es obligatoria. Búscala con IA, selecciona en el mapa o usa tu ubicación actual.',
    )
  }

  const restaurants = parseRestaurantRows(await runJsonQuery(ROUTE_QUERIES.restaurants))
  const normalizedName = normalizeName(nombre)
  const duplicateRestaurant = restaurants.find((restaurant) => {
    const sameName = restaurant.nombre_normalizado === normalizedName
    const nearby = distanceInMeters(lat, lng, restaurant.lat, restaurant.lng) < 50

    return sameName && nearby
  })

  if (duplicateRestaurant) {
    throw new Error(
      `Ya existe un restaurante similar: ${duplicateRestaurant.nombre}. Revisa si es el mismo lugar.`,
    )
  }

  const record = {
    id: randomUUID(),
    nombre,
    nombre_normalizado: normalizedName,
    direccion_texto: payload.direccion_texto?.trim() ?? '',
    google_maps_url:
      payload.google_maps_url?.trim() || `https://maps.google.com/?q=${lat},${lng}`,
    lat,
    lng,
    precio_rango: payload.precio_rango?.trim() || '€',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    notas: payload.notas?.trim() ?? '',
    created_at: new Date().toISOString(),
    created_by_user_id: payload.created_by_user_id,
    cover_photo_url: payload.cover_photo_url?.trim() ?? '',
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

async function createCategory(payload) {
  const nombre = payload.nombre?.trim()

  if (!nombre) {
    throw new Error('La categoría necesita un nombre.')
  }

  const existingCategories = await runJsonQuery(ROUTE_QUERIES.categories)
  const normalizedName = normalizeName(nombre)
  const duplicateCategory = existingCategories.find(
    (category) => normalizeName(category.nombre) === normalizedName,
  )

  if (duplicateCategory) {
    throw new Error(`La categoría "${duplicateCategory.nombre}" ya existe.`)
  }

  const record = {
    id: randomUUID(),
    nombre,
    icono: payload.icono?.trim() || '🍽️',
    scope: payload.scope?.trim() || 'usuario',
    created_by_user_id: payload.created_by_user_id ?? null,
  }

  const createdByValue = record.created_by_user_id
    ? `'${escapeSqlString(record.created_by_user_id)}'`
    : 'NULL'

  const sql = `
    INSERT INTO categories (id, nombre, icono, scope, created_by_user_id)
    VALUES (
      '${escapeSqlString(record.id)}',
      '${escapeSqlString(record.nombre)}',
      '${escapeSqlString(record.icono)}',
      '${escapeSqlString(record.scope)}',
      ${createdByValue}
    );
  `

  await runWriteQuery(sql)
  return record
}

async function createDishType(payload) {
  const nombre = payload.nombre?.trim()
  const categoriaId = payload.categoria_id?.trim()

  if (!categoriaId) {
    throw new Error('Falta la categoría del tipo de plato.')
  }

  if (!nombre) {
    throw new Error('El tipo de plato necesita un nombre.')
  }

  const existingDishTypes = await runJsonQuery(ROUTE_QUERIES.dishTypes)
  const normalizedName = normalizeName(nombre)
  const duplicateDishType = existingDishTypes.find(
    (dishType) =>
      dishType.categoria_id === categoriaId &&
      normalizeName(dishType.nombre) === normalizedName,
  )

  if (duplicateDishType) {
    throw new Error(`El tipo de plato "${duplicateDishType.nombre}" ya existe en esa categoría.`)
  }

  const record = {
    id: randomUUID(),
    categoria_id: categoriaId,
    nombre,
    alias: payload.alias?.trim() || null,
    scope: payload.scope?.trim() || 'usuario',
    created_by_user_id: payload.created_by_user_id ?? null,
  }

  const aliasValue = record.alias ? `'${escapeSqlString(record.alias)}'` : 'NULL'
  const createdByValue = record.created_by_user_id
    ? `'${escapeSqlString(record.created_by_user_id)}'`
    : 'NULL'

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
      ${aliasValue},
      '${escapeSqlString(record.scope)}',
      ${createdByValue}
    );
  `

  await runWriteQuery(sql)
  return record
}

async function createDishEntry(payload) {
  const requiredFields = [
    ['restaurant_id', 'Falta el restaurante.'],
    ['categoria_id', 'Falta la categoría.'],
    ['tipo_plato_id', 'Falta el tipo de plato.'],
    ['created_by_user_id', 'Falta el autor de la valoración.'],
    ['visibility', 'Falta la visibilidad.'],
    ['fecha', 'Falta la fecha de la valoración.'],
  ]

  for (const [field, message] of requiredFields) {
    if (!payload[field]) {
      throw new Error(message)
    }
  }

  const scoreFields = {
    sabor: Number(payload.sabor),
    textura: Number(payload.textura),
    presentacion: Number(payload.presentacion),
    calidad_precio: Number(payload.calidad_precio),
  }

  const validScoreFields = Object.entries(scoreFields).filter(([, value]) => !Number.isNaN(value))
  if (validScoreFields.length === 0) {
    throw new Error('Introduce al menos una subpuntuación.')
  }

  for (const [field, value] of validScoreFields) {
    if (value < 0 || value > 10) {
      throw new Error(`La puntuación "${field}" debe estar entre 0.0 y 10.0.`)
    }
  }

  const dishEntries = await runJsonQuery(ROUTE_QUERIES.dishEntries)
  const duplicateEntry = dishEntries.find(
    (entry) =>
      entry.created_by_user_id === payload.created_by_user_id &&
      entry.restaurant_id === payload.restaurant_id &&
      entry.tipo_plato_id === payload.tipo_plato_id &&
      entry.fecha === payload.fecha,
  )

  if (duplicateEntry) {
    throw new Error(
      'Ya existe una valoración de ese usuario para el mismo plato, restaurante y fecha.',
    )
  }

  const record = {
    id: randomUUID(),
    restaurant_id: payload.restaurant_id,
    categoria_id: payload.categoria_id,
    tipo_plato_id: payload.tipo_plato_id,
    nombre_plato: payload.nombre_plato?.trim() || null,
    sabor: Number.isNaN(scoreFields.sabor) ? null : scoreFields.sabor,
    textura: Number.isNaN(scoreFields.textura) ? null : scoreFields.textura,
    presentacion: Number.isNaN(scoreFields.presentacion)
      ? null
      : scoreFields.presentacion,
    calidad_precio: Number.isNaN(scoreFields.calidad_precio)
      ? null
      : scoreFields.calidad_precio,
    precio_plato:
      payload.precio_plato === null || payload.precio_plato === undefined || payload.precio_plato === ''
        ? null
        : Number(payload.precio_plato),
    notas: payload.notas?.trim() || null,
    fecha: payload.fecha,
    foto_url: payload.foto_url?.trim() || null,
    created_by_user_id: payload.created_by_user_id,
    group_id: payload.group_id?.trim() || null,
    visibility: payload.visibility,
    created_at: new Date().toISOString(),
  }

  if (record.visibility === 'group' && !record.group_id) {
    throw new Error('Las entradas visibles para grupo necesitan un group_id.')
  }

  const sqlValue = (value) =>
    value === null || value === undefined ? 'NULL' : `'${escapeSqlString(value)}'`
  const numericSqlValue = (value) =>
    value === null || value === undefined ? 'NULL' : String(value)

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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

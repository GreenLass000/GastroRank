import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
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
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'gastrorank-dev-secret-change-me'
const requestBuckets = new Map()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])
const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

await mkdir(UPLOADS_DIR, { recursive: true })

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function sendBinary(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  response.end(body)
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function createAuthToken(user) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email ?? null,
      exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS,
    }),
  )
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

function verifyAuthToken(token) {
  const [header, payload, signature] = String(token ?? '').split('.')

  if (!header || !payload || !signature) {
    throw new Error('Token inválido.')
  }

  const expectedSignature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Firma de token inválida.')
  }

  const decodedPayload = JSON.parse(fromBase64Url(payload))

  if (
    typeof decodedPayload.exp !== 'number' ||
    decodedPayload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('El token ha caducado.')
  }

  if (!decodedPayload.sub) {
    throw new Error('El token no identifica a ningún usuario.')
  }

  return decodedPayload
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const digest = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`
}

function verifyPassword(password, passwordHash) {
  const [algorithm, saltBase64, digestBase64] = String(passwordHash ?? '').split('$')

  if (algorithm !== 'scrypt' || !saltBase64 || !digestBase64) {
    return false
  }

  const salt = Buffer.from(saltBase64, 'base64url')
  const expectedDigest = Buffer.from(digestBase64, 'base64url')
  const actualDigest = scryptSync(password, salt, expectedDigest.length)

  return timingSafeEqual(actualDigest, expectedDigest)
}

function serializeUser(user, { includeEmail = false } = {}) {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    nombre: user.nombre,
    bio: user.bio ?? '',
    avatar_url: user.avatar_url ?? '',
    created_at: user.created_at,
    ...(includeEmail ? { email: user.email ?? '' } : {}),
  }
}

function getClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return request.socket.remoteAddress || 'unknown'
}

function getBaseUrl(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] ?? '').trim()
  const protocol = forwardedProto || 'http'
  return `${protocol}://${request.headers.host}`
}

function normalizeUploadKind(value) {
  const kind = String(value ?? '').trim().toLowerCase()
  return ['avatar', 'dish', 'restaurant'].includes(kind) ? kind : 'image'
}

function getUploadExtension(file) {
  const mimeType = String(file.type ?? '').toLowerCase()

  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType]
  }

  const fileName = String(file.name ?? '')
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
  return extension || 'jpg'
}

async function readMultipartFormData(request) {
  const bodyStream = ReadableStream.from(request)
  const multipartRequest = new Request(getBaseUrl(request) + request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyStream,
    duplex: 'half',
  })

  return multipartRequest.formData()
}

async function storeUpload(request, authenticatedUserId) {
  getAuthenticatedUserId(authenticatedUserId)

  const formData = await readMultipartFormData(request)
  const file = formData.get('file')

  if (!(file instanceof File)) {
    throw new Error('No se recibió ningún archivo.')
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(String(file.type ?? '').toLowerCase())) {
    throw new Error('Formato no permitido. Usa jpg, jpeg, png, webp o heic.')
  }

  if (file.size <= 0) {
    throw new Error('El archivo recibido está vacío.')
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error('La imagen supera el límite de 25MB.')
  }

  const extension = getUploadExtension(file)
  const kind = normalizeUploadKind(formData.get('kind'))
  const fileName = `${kind}-${randomUUID()}.${extension}`
  const filePath = path.join(UPLOADS_DIR, fileName)
  const bytes = Buffer.from(await file.arrayBuffer())

  await writeFile(filePath, bytes)

  return {
    path: `/uploads/${fileName}`,
    url: `${getBaseUrl(request)}/uploads/${fileName}`,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  }
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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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

function getRequiredEmail(value) {
  const email = getRequiredString(value, 'el email').toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El email no es válido.')
  }

  return email
}

function normalizeAuthIdentifier(value) {
  return getRequiredString(value, 'el usuario o correo').toLowerCase()
}

function getRequiredPassword(value, label = 'la contraseña') {
  const password = getRequiredString(value, label)

  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.')
  }

  return password
}

function readBearerToken(request) {
  const authorization = String(request.headers.authorization ?? '')

  if (!authorization.startsWith('Bearer ')) {
    return ''
  }

  return authorization.slice('Bearer '.length).trim()
}

async function requireAuth(request) {
  const token = readBearerToken(request)

  if (!token) {
    const error = new Error('No autorizado.')
    error.statusCode = 401
    throw error
  }

  let session

  try {
    session = verifyAuthToken(token)
  } catch (error) {
    const authError = new Error(
      error instanceof Error ? error.message : 'Token inválido.',
    )
    authError.statusCode = 401
    throw authError
  }

  const users = await FETCH.users()
  const user = users.find((candidate) => candidate.id === session.sub)

  if (!user) {
    const error = new Error('La sesión ya no es válida.')
    error.statusCode = 401
    throw error
  }

  return user
}

function getAuthenticatedUserId(user) {
  return getRequiredString(typeof user === 'string' ? user : user?.id, 'el usuario autenticado')
}

function getCurrentUserIdFromSearchParams(searchParams, authenticatedUserId = '') {
  const userId =
    searchParams.get('user_id') ??
    searchParams.get('current_user_id') ??
    searchParams.get('viewer_user_id')

  if (!userId && authenticatedUserId) {
    return authenticatedUserId
  }

  const resolvedUserId = getRequiredString(userId, 'el user_id actual')

  if (authenticatedUserId && resolvedUserId !== authenticatedUserId) {
    const error = new Error('No puedes solicitar datos privados de otro usuario.')
    error.statusCode = 403
    throw error
  }

  return resolvedUserId
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
  return new Map(users.map((u) => [u.id, serializeUser(u)]))
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

async function ensureUserCanAccessDishEntry(entryId, userId, message = '') {
  const [entry] = await db
    .select()
    .from(schema.dishEntries)
    .where(eq(schema.dishEntries.id, entryId))
    .limit(1)

  if (!entry) {
    throw new Error('No existe la valoración solicitada.')
  }

  if (entry.created_by_user_id === userId || entry.visibility === 'public') {
    return entry
  }

  if (entry.visibility === 'group' && entry.group_id) {
    const [membership] = await db
      .select({ id: schema.groupMembers.id })
      .from(schema.groupMembers)
      .where(
        and(
          eq(schema.groupMembers.group_id, entry.group_id),
          eq(schema.groupMembers.user_id, userId),
          eq(schema.groupMembers.status, 'active'),
        ),
      )
      .limit(1)

    if (membership) {
      return entry
    }
  }

  const error = new Error(
    message || 'No puedes acceder a una valoración que no está visible para tu cuenta.',
  )
  error.statusCode = 403
  throw error
}

function buildSharedGroupIdsByUser(groupMembers, currentUserId, candidateUserIds) {
  return candidateUserIds.reduce((acc, candidateUserId) => {
    const sharedGroupIds = buildSharedGroupIds(
      groupMembers,
      currentUserId,
      candidateUserId,
    )

    if (sharedGroupIds.size > 0) {
      acc.set(candidateUserId, sharedGroupIds)
    }

    return acc
  }, new Map())
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

async function getVisibleDishEntriesForUser(currentUserId) {
  const [dishEntries, groupMembers] = await Promise.all([
    FETCH.dishEntries(),
    FETCH.groupMembers(),
  ])

  const activeGroupIds = new Set(
    groupMembers
      .filter((member) => member.user_id === currentUserId && member.status === 'active')
      .map((member) => member.group_id),
  )

  return dishEntries.filter((entry) => {
    if (entry.created_by_user_id === currentUserId || entry.visibility === 'public') {
      return true
    }

    return entry.visibility === 'group' && entry.group_id && activeGroupIds.has(entry.group_id)
  })
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

async function registerUser(payload) {
  const nombre = getRequiredString(payload.nombre, 'el usuario')
  const email = getRequiredEmail(payload.email)
  const password = getRequiredPassword(payload.password)
  const users = await FETCH.users()
  const normalizedUserName = nombre.toLowerCase()

  if (users.some((user) => String(user.email ?? '').toLowerCase() === email)) {
    throw new Error('Ya existe una cuenta con ese email.')
  }

  if (users.some((user) => String(user.nombre ?? '').trim().toLowerCase() === normalizedUserName)) {
    throw new Error('Ya existe una cuenta con ese usuario.')
  }

  const record = {
    id: randomUUID(),
    nombre,
    email,
    password_hash: hashPassword(password),
    bio: '',
    avatar_url: '',
    created_at: new Date().toISOString(),
  }

  await db.insert(schema.users).values(record)

  return {
    user: serializeUser(record, { includeEmail: true }),
    token: createAuthToken(record),
  }
}

async function loginUser(payload) {
  const identifier = normalizeAuthIdentifier(payload.identifier ?? payload.email)
  const password = getRequiredPassword(payload.password)
  const users = await FETCH.users()
  const user = users.find((candidate) => {
    const candidateEmail = String(candidate.email ?? '').toLowerCase()
    const candidateUserName = String(candidate.nombre ?? '').trim().toLowerCase()
    return candidateEmail === identifier || candidateUserName === identifier
  })

  if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
    const error = new Error('Usuario/correo o contraseña incorrectos.')
    error.statusCode = 401
    throw error
  }

  return {
    user: serializeUser(user, { includeEmail: true }),
    token: createAuthToken(user),
  }
}

async function updatePasswordForUser(userId, payload) {
  const currentPassword = getRequiredPassword(payload.currentPassword, 'la contraseña actual')
  const newPassword = getRequiredPassword(payload.newPassword, 'la nueva contraseña')
  const users = await FETCH.users()
  const currentUser = ensureRecordExists(users, userId, 'el usuario autenticado')

  if (!currentUser.password_hash || !verifyPassword(currentPassword, currentUser.password_hash)) {
    const error = new Error('La contraseña actual no coincide.')
    error.statusCode = 401
    throw error
  }

  if (currentPassword === newPassword) {
    throw new Error('La nueva contraseña debe ser distinta de la actual.')
  }

  const [updated] = await db
    .update(schema.users)
    .set({ password_hash: hashPassword(newPassword) })
    .where(eq(schema.users.id, userId))
    .returning()

  return serializeUser(updated ?? currentUser, { includeEmail: true })
}

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

  const insertValues = {
    id: randomUUID(),
    ...p,
    created_at: new Date().toISOString(),
  }
  delete insertValues.puntuacion_general

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
  const current = ensureRecordExists(users, userId, 'el usuario solicitado')
  const p = validateUserPayload(payload)
  const bio = getOptionalString(payload.bio) ?? current.bio ?? ''

  const [updated] = await db
    .update(schema.users)
    .set({ nombre: p.nombre, avatar_url: p.avatar_url, bio })
    .where(eq(schema.users.id, userId))
    .returning()

  return serializeUser(updated, { includeEmail: true })
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

async function searchUsers(query, actorUserId) {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return { users: [] }
  }

  const [users, follows] = await Promise.all([FETCH.users(), FETCH.follows()])
  ensureRecordExists(users, actorUserId, 'el usuario autenticado')
  const followsByPair = new Set(
    follows.map((follow) => `${follow.follower_user_id}:${follow.followed_user_id}`),
  )

  return {
    users: users
      .filter((user) => user.id !== actorUserId)
      .filter((user) =>
        normalizeSearchText(`${user.nombre} ${user.bio ?? ''}`).includes(normalizedQuery),
      )
      .slice(0, 20)
      .map((user) => {
        const isFollowing = followsByPair.has(`${actorUserId}:${user.id}`)
        const followsYou = followsByPair.has(`${user.id}:${actorUserId}`)

        return {
          ...serializeUser(user),
          isFollowing,
          followsYou,
          isMutual: isFollowing && followsYou,
        }
      }),
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

async function getCommunityFeed(searchParams, authenticatedUserId) {
  const currentUserId = getAuthenticatedUserId(authenticatedUserId)
  const tab = searchParams.get('tab') === 'amigos' ? 'amigos' : 'explorar'
  const page = Math.max(1, parseInteger(searchParams.get('page'), 1))
  const pageSize = Math.min(30, Math.max(1, parseInteger(searchParams.get('page_size'), 10)))
  const filters = parseFilters(searchParams)

  const [currentUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, currentUserId))
    .limit(1)

  if (!currentUser) {
    throw new Error('No existe el usuario actual.')
  }

  const conditions = [ne(schema.dishEntries.created_by_user_id, currentUserId)]

  if (tab === 'amigos') {
    const follows = await db
      .select()
      .from(schema.follows)
      .where(
        or(
          eq(schema.follows.follower_user_id, currentUserId),
          eq(schema.follows.followed_user_id, currentUserId),
        ),
      )

    const mutualFollowIds = [...buildMutualFollowIds(follows, currentUserId)]

    if (mutualFollowIds.length === 0) {
      return {
        tab,
        page: 1,
        pageSize,
        page_size: pageSize,
        total: 0,
        total_items: 0,
        totalPages: 1,
        total_pages: 1,
        filters,
        items: [],
        entries: [],
      }
    }

    const groupMembers = await db
      .select()
      .from(schema.groupMembers)
      .where(
        and(
          eq(schema.groupMembers.status, 'active'),
          or(
            eq(schema.groupMembers.user_id, currentUserId),
            inArray(schema.groupMembers.user_id, mutualFollowIds),
          ),
        ),
      )

    const sharedGroupIdsByUser = buildSharedGroupIdsByUser(
      groupMembers,
      currentUserId,
      mutualFollowIds,
    )
    const groupVisibilityConditions = mutualFollowIds
      .map((followedUserId) => {
        const sharedGroupIds = [...(sharedGroupIdsByUser.get(followedUserId) ?? [])]

        if (sharedGroupIds.length === 0) {
          return null
        }

        return and(
          eq(schema.dishEntries.created_by_user_id, followedUserId),
          eq(schema.dishEntries.visibility, 'group'),
          inArray(schema.dishEntries.group_id, sharedGroupIds),
        )
      })
      .filter(Boolean)

    const visibilityConditions = [
      and(
        inArray(schema.dishEntries.created_by_user_id, mutualFollowIds),
        eq(schema.dishEntries.visibility, 'public'),
      ),
      ...groupVisibilityConditions,
    ]

    conditions.push(or(...visibilityConditions))
  } else {
    conditions.push(eq(schema.dishEntries.visibility, 'public'))
  }

  if (filters.categoryIds.length > 0) {
    conditions.push(inArray(schema.dishEntries.categoria_id, filters.categoryIds))
  }

  if (filters.dishTypeIds.length > 0) {
    conditions.push(inArray(schema.dishEntries.tipo_plato_id, filters.dishTypeIds))
  }

  if (filters.priceRange.length > 0) {
    const matchingRestaurants = await db
      .select({ id: schema.restaurants.id })
      .from(schema.restaurants)
      .where(inArray(schema.restaurants.precio_rango, filters.priceRange))
    const restaurantIds = matchingRestaurants.map((restaurant) => restaurant.id)

    if (restaurantIds.length === 0) {
      return {
        tab,
        page: 1,
        pageSize,
        page_size: pageSize,
        total: 0,
        total_items: 0,
        totalPages: 1,
        total_pages: 1,
        filters,
        items: [],
        entries: [],
      }
    }

    conditions.push(inArray(schema.dishEntries.restaurant_id, restaurantIds))
  }

  if (typeof filters.minScore === 'number' && !Number.isNaN(filters.minScore)) {
    conditions.push(gte(schema.dishEntries.puntuacion_general, filters.minScore))
  }

  if (filters.dateFrom) {
    conditions.push(gte(schema.dishEntries.fecha, filters.dateFrom))
  }

  if (filters.dateTo) {
    conditions.push(lte(schema.dishEntries.fecha, filters.dateTo))
  }

  const whereClause = and(...conditions)
  const totalCountRows = await db
    .select({ count: sql`count(*)` })
    .from(schema.dishEntries)
    .where(whereClause)
  const totalItems = Number(totalCountRows[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize
  const paginatedEntries =
    totalItems > 0
      ? await db
          .select()
          .from(schema.dishEntries)
          .where(whereClause)
          .orderBy(desc(schema.dishEntries.created_at), desc(schema.dishEntries.fecha))
          .limit(pageSize)
          .offset(offset)
      : []

  if (paginatedEntries.length === 0) {
    return {
      tab,
      page: currentPage,
      pageSize,
      page_size: pageSize,
      total: totalItems,
      total_items: totalItems,
      totalPages,
      total_pages: totalPages,
      filters,
      items: [],
      entries: [],
    }
  }

  const entryIds = paginatedEntries.map((entry) => entry.id)
  const authorIds = [...new Set(paginatedEntries.map((entry) => entry.created_by_user_id))]
  const restaurantIds = [...new Set(paginatedEntries.map((entry) => entry.restaurant_id))]
  const categoryIds = [...new Set(paginatedEntries.map((entry) => entry.categoria_id))]
  const dishTypeIds = [...new Set(paginatedEntries.map((entry) => entry.tipo_plato_id))]
  const [users, restaurants, categories, dishTypes, reactions, comments] =
    await Promise.all([
      db.select().from(schema.users).where(inArray(schema.users.id, authorIds)),
      db.select().from(schema.restaurants).where(inArray(schema.restaurants.id, restaurantIds)),
      db.select().from(schema.categories).where(inArray(schema.categories.id, categoryIds)),
      db.select().from(schema.dishTypes).where(inArray(schema.dishTypes.id, dishTypeIds)),
      db
        .select()
        .from(schema.reactions)
        .where(inArray(schema.reactions.dish_entry_id, entryIds))
        .orderBy(desc(schema.reactions.created_at)),
      db
        .select()
        .from(schema.comments)
        .where(inArray(schema.comments.dish_entry_id, entryIds))
        .orderBy(asc(schema.comments.created_at)),
    ])

  const restaurantsById = new Map(
    parseRestaurantRows(restaurants).map((restaurant) => [restaurant.id, restaurant]),
  )
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const dishTypesById = new Map(dishTypes.map((dishType) => [dishType.id, dishType]))
  const usersById = buildUserLookup(users)
  const reactionsByEntryId = new Map()
  const commentsByEntryId = new Map()

  reactions.forEach((reaction) => {
    const list = reactionsByEntryId.get(reaction.dish_entry_id) ?? []
    list.push(reaction)
    reactionsByEntryId.set(reaction.dish_entry_id, list)
  })

  comments.forEach((comment) => {
    const list = commentsByEntryId.get(comment.dish_entry_id) ?? []
    list.push({ ...comment, mentions: parseJsonValue(comment.mentions, []) })
    commentsByEntryId.set(comment.dish_entry_id, list)
  })

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
    pageSize,
    page_size: pageSize,
    total: totalItems,
    total_items: totalItems,
    totalPages,
    total_pages: totalPages,
    filters,
    items: paginatedEntries.map((entry) => buildCommunityEntry(entry, context)),
    entries: paginatedEntries.map((entry) => buildCommunityEntry(entry, context)),
  }
}

async function addOrUpdateReaction(payload) {
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const userId = getRequiredString(payload.user_id, 'el user_id')
  const reactionType = normalizeReactionType(payload.reaction_type)

  const [, users] = await Promise.all([
    ensureUserCanAccessDishEntry(
      dishEntryId,
      userId,
      'No puedes reaccionar a una valoración privada de otro usuario.',
    ),
    FETCH.users(),
  ])
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

async function deleteReaction(reactionId, actorUserId) {
  const reactions = await FETCH.reactions()
  const reaction = ensureRecordExists(reactions, reactionId, 'la reacción')

  if (reaction.user_id !== actorUserId) {
    const error = new Error('No puedes borrar la reacción de otro usuario.')
    error.statusCode = 403
    throw error
  }

  await db.delete(schema.reactions).where(eq(schema.reactions.id, reactionId))
  return { ok: true }
}

async function getCommentsForEntry(entryId, actorUserId) {
  const [comments, users] = await Promise.all([
    FETCH.comments(),
    FETCH.users(),
    ensureUserCanAccessDishEntry(
      entryId,
      actorUserId,
      'No puedes leer comentarios de una valoración privada de otro usuario.',
    ),
  ])

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

  const [, users] = await Promise.all([
    ensureUserCanAccessDishEntry(
      dishEntryId,
      userId,
      'No puedes comentar una valoración privada de otro usuario.',
    ),
    FETCH.users(),
  ])
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
    user: serializeUser(ensureRecordExists(users, userId, 'el usuario del comentario')),
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

async function createInspirationListItem(payload, actorUserId) {
  const listId = getRequiredString(payload.list_id, 'el list_id')
  const dishEntryId = getRequiredString(payload.dish_entry_id, 'el dish_entry_id')
  const tried = Boolean(payload.tried)
  const now = new Date().toISOString()

  const [lists, dishEntries, items] = await Promise.all([
    FETCH.inspirationLists(),
    FETCH.dishEntries(),
    FETCH.inspirationListItems(),
  ])

  const list = ensureRecordExists(lists, listId, 'la lista')
  ensureRecordExists(dishEntries, dishEntryId, 'la valoración')

  if (list.user_id !== actorUserId) {
    const error = new Error('No puedes guardar elementos en la lista de otro usuario.')
    error.statusCode = 403
    throw error
  }

  await ensureUserCanAccessDishEntry(
    dishEntryId,
    actorUserId,
    'No puedes guardar en listas una valoración privada de otro usuario.',
  )

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

async function updateInspirationListItem(itemId, payload, actorUserId) {
  const items = await FETCH.inspirationListItems()
  const current = ensureRecordExists(items, itemId, 'el elemento de lista')
  const lists = await FETCH.inspirationLists()
  const list = ensureRecordExists(lists, current.list_id, 'la lista del elemento')

  if (list.user_id !== actorUserId) {
    const error = new Error('No puedes editar elementos de la lista de otro usuario.')
    error.statusCode = 403
    throw error
  }

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

  await ensureUserCanAccessDishEntry(
    dishEntryId,
    fromUserId,
    'No puedes recomendar una valoración que no está visible para tu cuenta.',
  )
  await ensureUserCanAccessDishEntry(
    dishEntryId,
    toUserId,
    'No puedes recomendar una valoración que el destinatario no puede ver.',
  )

  if (!buildMutualFollowIds(follows, fromUserId).has(toUserId)) {
    const error = new Error('Solo puedes enviar recomendaciones a amistades mutuas.')
    error.statusCode = 403
    throw error
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

async function markRecommendationSeen(recommendationId, actorUserId) {
  const recs = await FETCH.recommendations()
  const recommendation = ensureRecordExists(recs, recommendationId, 'la recomendación')

  if (recommendation.to_user_id !== actorUserId) {
    const error = new Error('No puedes marcar recomendaciones de otro usuario.')
    error.statusCode = 403
    throw error
  }

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

async function updateAchievement(achievementId, payload, actorUserId) {
  const achievements = await FETCH.achievements()
  const achievement = ensureRecordExists(achievements, achievementId, 'el logro solicitado')

  if (achievement.user_id !== actorUserId) {
    const error = new Error('No puedes editar logros de otro usuario.')
    error.statusCode = 403
    throw error
  }

  const notified =
    payload.notified !== undefined
      ? Boolean(payload.notified)
      : achievement.notified ?? false

  const [updated] = await db
    .update(schema.achievements)
    .set({ notified })
    .where(eq(schema.achievements.id, achievementId))
    .returning()

  return updated
}

async function loadBootstrapData({ currentUserId, includeSocial = false } = {}) {
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

  const visibleDishEntries = currentUserId
    ? await getVisibleDishEntriesForUser(currentUserId)
    : dishEntries.filter((entry) => entry.visibility === 'public')

  const visibleEntryIds = new Set(visibleDishEntries.map((entry) => entry.id))
  const visibleUserIds = new Set(
    visibleDishEntries.map((entry) => entry.created_by_user_id).filter(Boolean),
  )
  const visibleGroupIds = new Set(
    visibleDishEntries
      .map((entry) => (entry.visibility === 'group' ? entry.group_id : null))
      .filter(Boolean),
  )
  if (currentUserId) {
    visibleUserIds.add(currentUserId)
  }
  const activeCurrentUserGroupIds = new Set(
    groupMembers
      .filter((member) => member.user_id === currentUserId && member.status === 'active')
      .map((member) => member.group_id),
  )
  activeCurrentUserGroupIds.forEach((groupId) => visibleGroupIds.add(groupId))
  groupMembers.forEach((member) => {
    if (visibleGroupIds.has(member.group_id)) {
      visibleUserIds.add(member.user_id)
    }
  })

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

    follows = currentUserId
      ? follows.filter(
          (follow) =>
            follow.follower_user_id === currentUserId ||
            follow.followed_user_id === currentUserId,
        )
      : []
    reactions = reactions.filter((reaction) => visibleEntryIds.has(reaction.dish_entry_id))
    comments = comments.filter((comment) => visibleEntryIds.has(comment.dish_entry_id))
    inspirationLists = currentUserId
      ? inspirationLists.filter((list) => list.user_id === currentUserId)
      : []
    const visibleListIds = new Set(inspirationLists.map((list) => list.id))
    inspirationListItems = inspirationListItems.filter((item) => visibleListIds.has(item.list_id))
    recommendations = currentUserId
      ? recommendations.filter(
          (recommendation) =>
            recommendation.from_user_id === currentUserId ||
            recommendation.to_user_id === currentUserId,
        )
      : []
    achievements = currentUserId
      ? achievements.filter((achievement) => achievement.user_id === currentUserId)
      : []

    follows.forEach((follow) => {
      visibleUserIds.add(follow.follower_user_id)
      visibleUserIds.add(follow.followed_user_id)
    })
    recommendations.forEach((recommendation) => {
      visibleUserIds.add(recommendation.from_user_id)
      visibleUserIds.add(recommendation.to_user_id)
      visibleEntryIds.add(recommendation.dish_entry_id)
    })
  }

  return {
    users: users
      .filter((user) => visibleUserIds.has(user.id))
      .map((user) => serializeUser(user)),
    groups: groups.filter(
      (group) =>
        visibleGroupIds.has(group.id) ||
        (currentUserId && group.created_by_user_id === currentUserId),
    ),
    groupMembers: groupMembers.filter((member) => visibleGroupIds.has(member.group_id)),
    restaurants: parseRestaurantRows(restaurants),
    categories,
    dishTypes,
    dishEntries: visibleDishEntries,
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

async function handleRoute(url, response, authUser = null) {
  const { pathname, searchParams } = url

  if (pathname.startsWith('/uploads/')) {
    const fileName = pathname.replace('/uploads/', '').trim()
    const safeFileName = path.basename(fileName)

    if (!safeFileName || safeFileName !== fileName) {
      return sendJson(response, 400, { error: 'Ruta de archivo no válida.' })
    }

    try {
      const filePath = path.join(UPLOADS_DIR, safeFileName)
      const body = await readFile(filePath)
      const extension = safeFileName.split('.').pop()?.toLowerCase() ?? ''
      const contentType =
        Object.entries(MIME_EXTENSION_MAP).find(([, mappedExtension]) => mappedExtension === extension)?.[0] ??
        'application/octet-stream'

      return sendBinary(response, 200, body, contentType)
    } catch {
      return sendJson(response, 404, { error: 'Archivo no encontrado.' })
    }
  }

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
    return sendJson(
      response,
      200,
      await loadBootstrapData({
        currentUserId: authUser ? getAuthenticatedUserId(authUser) : '',
        includeSocial,
      }),
    )
  }

  if (pathname === '/api/users/search') {
    return sendJson(
      response,
      200,
      await searchUsers(
        searchParams.get('q') ?? '',
        getAuthenticatedUserId(authUser),
      ),
    )
  }

  if (pathname.startsWith('/api/public-share/')) {
    const token = pathname.replace('/api/public-share/', '').trim()
    return sendJson(response, 200, await loadPublicSharePayload(token))
  }

  if (pathname === '/api/follows') {
    const userId = getCurrentUserIdFromSearchParams(
      searchParams,
      getAuthenticatedUserId(authUser),
    )
    return sendJson(response, 200, await getFollowState(userId))
  }

  if (pathname === '/api/community/feed') {
    return sendJson(
      response,
      200,
      await getCommunityFeed(searchParams, getAuthenticatedUserId(authUser)),
    )
  }

  if (pathname.startsWith('/api/comments/')) {
    const entryId = decodeURIComponent(pathname.replace('/api/comments/', ''))
    return sendJson(response, 200, {
      comments: await getCommentsForEntry(entryId, getAuthenticatedUserId(authUser)),
    })
  }

  if (pathname === '/api/inspiration-lists') {
    const userId = getCurrentUserIdFromSearchParams(
      searchParams,
      getAuthenticatedUserId(authUser),
    )
    return sendJson(response, 200, {
      inspirationLists: await getInspirationLists(userId),
    })
  }

  if (pathname === '/api/recommendations') {
    const userId = getCurrentUserIdFromSearchParams(
      searchParams,
      getAuthenticatedUserId(authUser),
    )
    return sendJson(response, 200, await getRecommendations(userId))
  }

  if (pathname === '/api/achievements') {
    const userId = getCurrentUserIdFromSearchParams(
      searchParams,
      getAuthenticatedUserId(authUser),
    )
    return sendJson(response, 200, await getAchievements(userId))
  }

  // Generic table reads
  const routeKey = pathname.replace('/api/', '')

  if (routeKey in FETCH) {
    const blockedGenericReads = new Set([
      'users',
      'groups',
      'groupMembers',
      'dishEntries',
      'publicShareTokens',
      'follows',
      'reactions',
      'comments',
      'inspirationLists',
      'inspirationListItems',
      'recommendations',
      'achievements',
    ])

    if (blockedGenericReads.has(routeKey)) {
      return sendJson(response, 403, {
        error: 'Ruta no disponible. Usa los endpoints específicos con control de acceso.',
      })
    }

    const rows = await FETCH[routeKey]()
    const payload =
      routeKey === 'restaurants'
        ? parseRestaurantRows(rows)
        : routeKey === 'users'
          ? rows.map((user) => serializeUser(user))
          : rows
    return sendJson(response, 200, payload)
  }

  return sendJson(response, 404, { error: `Ruta no encontrada: ${pathname}` })
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function isPublicRoute(pathname) {
  return (
    pathname.startsWith('/uploads/') ||
    pathname === '/api/health' ||
    pathname === '/api/auth/register' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/me' ||
    pathname === '/api/public-share' ||
    pathname.startsWith('/api/public-share/')
  )
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    return sendJson(response, 400, { error: 'Petición inválida.' })
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
    const authUser = isPublicRoute(url.pathname) ? null : await requireAuth(request)

    if (request.method === 'GET') {
      if (url.pathname === '/api/auth/me') {
        sendJson(response, 200, { user: serializeUser(await requireAuth(request), { includeEmail: true }) })
        return
      }

      await handleRoute(url, response, authUser)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/upload') {
      sendJson(response, 201, {
        upload: await storeUpload(request, getAuthenticatedUserId(authUser)),
      })
      return
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      ensureJsonRequest(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readJsonBody(request)
      sendJson(response, 201, await registerUser(body))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJsonBody(request)
      sendJson(response, 200, await loginUser(body))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/follows') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        follow: await createFollow({
          ...body,
          follower_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/restaurants') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        restaurant: await createRestaurant({
          ...body,
          created_by_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/groups') {
      const body = await readJsonBody(request)
      sendJson(response, 201, await createGroup({
        ...body,
        created_by_user_id: getAuthenticatedUserId(authUser),
      }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/categories') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        category: await createCategory({
          ...body,
          created_by_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-types') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        dishType: await createDishType({
          ...body,
          created_by_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/dish-entries') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        dishEntry: await createDishEntry({
          ...body,
          created_by_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/reactions') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        reaction: await addOrUpdateReaction({
          ...body,
          user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/comments') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        comment: await createComment({
          ...body,
          user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-lists') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        inspirationList: await createInspirationList({
          ...body,
          user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/inspiration-list-items') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        inspirationListItem: await createInspirationListItem(
          body,
          getAuthenticatedUserId(authUser),
        ),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/recommendations') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        recommendation: await createRecommendation({
          ...body,
          from_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/achievements') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        achievement: await createAchievement({
          ...body,
          user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/public-share-tokens') {
      const body = await readJsonBody(request)
      sendJson(response, 201, {
        shareToken: await createPublicShareToken({
          ...body,
          created_by_user_id: getAuthenticatedUserId(authUser),
        }),
      })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/users/')) {
      const body = await readJsonBody(request)
      const userId = decodeURIComponent(url.pathname.replace('/api/users/', ''))
      if (userId !== getAuthenticatedUserId(authUser)) {
        const error = new Error('No puedes editar otro perfil.')
        error.statusCode = 403
        throw error
      }
      sendJson(response, 200, { user: await updateUser(userId, body) })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/auth/password') {
      const body = await readJsonBody(request)
      sendJson(response, 200, {
        user: await updatePasswordForUser(getAuthenticatedUserId(authUser), body),
      })
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
        inspirationListItem: await updateInspirationListItem(
          id,
          body,
          getAuthenticatedUserId(authUser),
        ),
      })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/recommendations/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/recommendations/', ''))
      sendJson(response, 200, {
        recommendation: await markRecommendationSeen(
          id,
          getAuthenticatedUserId(authUser),
        ),
      })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/achievements/')) {
      const body = await readJsonBody(request)
      const id = decodeURIComponent(url.pathname.replace('/api/achievements/', ''))
      sendJson(response, 200, {
        achievement: await updateAchievement(
          id,
          body,
          getAuthenticatedUserId(authUser),
        ),
      })
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/follows/')) {
      const followedUserId = decodeURIComponent(
        url.pathname.replace('/api/follows/', ''),
      )
      sendJson(
        response,
        200,
        await deleteFollow(getAuthenticatedUserId(authUser), followedUserId),
      )
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/reactions/')) {
      const reactionId = decodeURIComponent(url.pathname.replace('/api/reactions/', ''))
      sendJson(
        response,
        200,
        await deleteReaction(reactionId, getAuthenticatedUserId(authUser)),
      )
      return
    }

    return sendJson(response, 405, { error: 'Método no permitido.' })
  } catch (error) {
    return sendJson(response, error?.statusCode ?? 500, {
      error:
        error instanceof Error ? error.message : 'Error interno del servidor.',
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`API escuchando en http://${HOST}:${PORT}`)
  console.log(`Base de datos: PostgreSQL (${process.env.DATABASE_URL ?? 'localhost:5432'})`)
})

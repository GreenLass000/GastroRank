import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  pgView,
  real,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

const ts = (name) =>
  timestamp(name, { withTimezone: true, mode: 'string' })

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  email: text('email').unique(),
  password_hash: text('password_hash'),
  bio: text('bio'),
  avatar_url: text('avatar_url'),
  created_at: ts('created_at').notNull().defaultNow(),
})

export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    tipo: text('tipo').notNull(),
    visibility: text('visibility').notNull(),
    join_policy: text('join_policy').notNull(),
    invite_code: text('invite_code').notNull().unique(),
    created_by_user_id: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('groups_tipo_check', sql`${t.tipo} in ('pareja', 'amigos', 'familia', 'otros')`),
    check(
      'groups_visibility_check',
      sql`${t.visibility} in ('privado', 'público')`,
    ),
    check(
      'groups_join_policy_check',
      sql`${t.join_policy} in ('código', 'aprobación', 'abierto')`,
    ),
    check('groups_invite_code_length_check', sql`length(${t.invite_code}) = 6`),
    index('idx_groups_invite_code').on(t.invite_code),
  ],
)

export const groupMembers = pgTable(
  'group_members',
  {
    id: text('id').primaryKey(),
    group_id: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    status: text('status').notNull(),
    joined_at: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.group_id, t.user_id),
    check('group_members_role_check', sql`${t.role} in ('owner', 'admin', 'member')`),
    check('group_members_status_check', sql`${t.status} in ('active', 'pending')`),
    index('idx_group_members_group_id').on(t.group_id),
    index('idx_group_members_user_id').on(t.user_id),
  ],
)

export const restaurants = pgTable(
  'restaurants',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    nombre_normalizado: text('nombre_normalizado').notNull(),
    direccion_texto: text('direccion_texto'),
    google_maps_url: text('google_maps_url'),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    precio_rango: text('precio_rango'),
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    notas: text('notas'),
    created_at: ts('created_at').notNull().defaultNow(),
    created_by_user_id: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cover_photo_url: text('cover_photo_url'),
  },
  (t) => [
    check('restaurants_lat_check', sql`${t.lat} between -90 and 90`),
    check('restaurants_lng_check', sql`${t.lng} between -180 and 180`),
    check(
      'restaurants_precio_rango_check',
      sql`${t.precio_rango} is null or ${t.precio_rango} in ('€', '€€', '€€€')`,
    ),
    index('idx_restaurants_nombre_normalizado').on(t.nombre_normalizado),
    index('idx_restaurants_coordinates').on(t.lat, t.lng),
  ],
)

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    icono: text('icono').notNull(),
    scope: text('scope').notNull(),
    created_by_user_id: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    check(
      'categories_scope_check',
      sql`${t.scope} in ('global', 'grupo', 'usuario')`,
    ),
  ],
)

export const dishTypes = pgTable(
  'dish_types',
  {
    id: text('id').primaryKey(),
    categoria_id: text('categoria_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    alias: text('alias'),
    scope: text('scope').notNull(),
    created_by_user_id: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    check(
      'dish_types_scope_check',
      sql`${t.scope} in ('global', 'grupo', 'usuario')`,
    ),
    index('idx_dish_types_categoria_id').on(t.categoria_id),
  ],
)

const dishGeneralScoreSql = sql`ROUND(
  (
    COALESCE(sabor, 0) + COALESCE(textura, 0) +
    COALESCE(presentacion, 0) + COALESCE(calidad_precio, 0)
  )::numeric /
  NULLIF(
    (CASE WHEN sabor IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN textura IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN presentacion IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN calidad_precio IS NOT NULL THEN 1 ELSE 0 END),
    0
  )::numeric,
  1
)::real`

export const dishEntries = pgTable(
  'dish_entries',
  {
    id: text('id').primaryKey(),
    restaurant_id: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    categoria_id: text('categoria_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    tipo_plato_id: text('tipo_plato_id')
      .notNull()
      .references(() => dishTypes.id, { onDelete: 'cascade' }),
    nombre_plato: text('nombre_plato'),
    sabor: real('sabor'),
    textura: real('textura'),
    presentacion: real('presentacion'),
    calidad_precio: real('calidad_precio'),
    puntuacion_general: real('puntuacion_general').generatedAlwaysAs(
      dishGeneralScoreSql,
      { mode: 'stored' },
    ),
    precio_plato: real('precio_plato'),
    notas: text('notas'),
    fecha: date('fecha', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
    foto_url: text('foto_url'),
    created_by_user_id: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group_id: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    visibility: text('visibility').notNull(),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('dish_entries_sabor_check', sql`${t.sabor} is null or ${t.sabor} between 0 and 10`),
    check(
      'dish_entries_textura_check',
      sql`${t.textura} is null or ${t.textura} between 0 and 10`,
    ),
    check(
      'dish_entries_presentacion_check',
      sql`${t.presentacion} is null or ${t.presentacion} between 0 and 10`,
    ),
    check(
      'dish_entries_calidad_precio_check',
      sql`${t.calidad_precio} is null or ${t.calidad_precio} between 0 and 10`,
    ),
    check(
      'dish_entries_visibility_check',
      sql`${t.visibility} in ('private', 'group', 'public')`,
    ),
    check(
      'dish_entries_score_presence_check',
      sql`(
        (case when ${t.sabor} is not null then 1 else 0 end) +
        (case when ${t.textura} is not null then 1 else 0 end) +
        (case when ${t.presentacion} is not null then 1 else 0 end) +
        (case when ${t.calidad_precio} is not null then 1 else 0 end)
      ) >= 1`,
    ),
    check(
      'dish_entries_group_visibility_check',
      sql`${t.visibility} != 'group' or ${t.group_id} is not null`,
    ),
    index('idx_dish_entries_restaurant_id').on(t.restaurant_id),
    index('idx_dish_entries_tipo_plato_id').on(t.tipo_plato_id),
    index('idx_dish_entries_categoria_id').on(t.categoria_id),
    index('idx_dish_entries_created_by_user_id').on(t.created_by_user_id),
    index('idx_dish_entries_group_id').on(t.group_id),
    index('idx_dish_entries_fecha').on(t.fecha),
  ],
)

export const publicShareTokens = pgTable(
  'public_share_tokens',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    context: text('context').notNull(),
    ranking_type: text('ranking_type').notNull(),
    filters_json: jsonb('filters_json').notNull().default(sql`'{}'::jsonb`),
    group_id: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    created_by_user_id: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: ts('created_at').notNull().defaultNow(),
    expires_at: ts('expires_at'),
  },
  (t) => [
    check(
      'public_share_tokens_context_check',
      sql`${t.context} in ('mi_ranking', 'grupo', 'comunidad')`,
    ),
    index('idx_public_share_tokens_token').on(t.token),
  ],
)

export const follows = pgTable(
  'follows',
  {
    follower_user_id: text('follower_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followed_user_id: text('followed_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.follower_user_id, t.followed_user_id),
    check(
      'follows_self_reference_check',
      sql`${t.follower_user_id} != ${t.followed_user_id}`,
    ),
    index('idx_follows_follower_user_id').on(t.follower_user_id),
    index('idx_follows_followed_user_id').on(t.followed_user_id),
  ],
)

export const reactions = pgTable(
  'reactions',
  {
    id: text('id').primaryKey(),
    dish_entry_id: text('dish_entry_id')
      .notNull()
      .references(() => dishEntries.id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reaction_type: text('reaction_type').notNull(),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.dish_entry_id, t.user_id),
    check(
      'reactions_reaction_type_check',
      sql`${t.reaction_type} in ('quiero_probar', 'ya_probe', 'que_hambre', 'mejorable', 'paso')`,
    ),
    index('idx_reactions_dish_entry_id').on(t.dish_entry_id),
    index('idx_reactions_user_id').on(t.user_id),
  ],
)

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    dish_entry_id: text('dish_entry_id')
      .notNull()
      .references(() => dishEntries.id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    mentions: jsonb('mentions').notNull().default(sql`'[]'::jsonb`),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'comments_text_length_check',
      sql`length(trim(${t.text})) between 1 and 500`,
    ),
    index('idx_comments_dish_entry_id').on(t.dish_entry_id),
    index('idx_comments_user_id').on(t.user_id),
  ],
)

export const inspirationLists = pgTable(
  'inspiration_lists',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    is_default: boolean('is_default').notNull().default(false),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'inspiration_lists_name_length_check',
      sql`length(trim(${t.name})) between 1 and 120`,
    ),
    index('idx_inspiration_lists_user_id').on(t.user_id),
  ],
)

export const inspirationListItems = pgTable(
  'inspiration_list_items',
  {
    id: text('id').primaryKey(),
    list_id: text('list_id')
      .notNull()
      .references(() => inspirationLists.id, { onDelete: 'cascade' }),
    dish_entry_id: text('dish_entry_id')
      .notNull()
      .references(() => dishEntries.id, { onDelete: 'cascade' }),
    tried: boolean('tried').notNull().default(false),
    tried_at: ts('tried_at'),
    saved_at: ts('saved_at').notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.list_id, t.dish_entry_id),
    check(
      'inspiration_list_items_tried_at_check',
      sql`${t.tried} = false or ${t.tried_at} is not null`,
    ),
    index('idx_inspiration_list_items_list_id').on(t.list_id),
    index('idx_inspiration_list_items_dish_entry_id').on(t.dish_entry_id),
  ],
)

export const recommendations = pgTable(
  'recommendations',
  {
    id: text('id').primaryKey(),
    from_user_id: text('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    to_user_id: text('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dish_entry_id: text('dish_entry_id')
      .notNull()
      .references(() => dishEntries.id, { onDelete: 'cascade' }),
    seen: boolean('seen').notNull().default(false),
    created_at: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'recommendations_self_reference_check',
      sql`${t.from_user_id} != ${t.to_user_id}`,
    ),
    index('idx_recommendations_to_user_id').on(t.to_user_id),
    index('idx_recommendations_from_user_id').on(t.from_user_id),
    index('idx_recommendations_dish_entry_id').on(t.dish_entry_id),
  ],
)

export const achievements = pgTable(
  'achievements',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badge_type: text('badge_type').notNull(),
    unlocked_at: ts('unlocked_at').notNull().defaultNow(),
    notified: boolean('notified').notNull().default(false),
  },
  (t) => [
    unique().on(t.user_id, t.badge_type),
    check(
      'achievements_badge_type_check',
      sql`${t.badge_type} in (
        'croquetero',
        'exploradora',
        'foodie_visual',
        'sin_fronteras',
        'referente',
        'exigente',
        'habitual',
        'omnivoro',
        'social',
        'top_chef'
      )`,
    ),
    index('idx_achievements_user_id').on(t.user_id),
  ],
)

export const restaurantScores = pgView('restaurant_scores', {
  restaurant_id: text('restaurant_id'),
  restaurant_nombre: text('restaurant_nombre'),
  restaurant_score: real('restaurant_score'),
  total_dish_entries: bigint('total_dish_entries', { mode: 'number' }),
  best_dish_name: text('best_dish_name'),
}).as(sql`
  SELECT
    r.id AS restaurant_id,
    r.nombre AS restaurant_nombre,
    ROUND(AVG(de.puntuacion_general)::numeric, 3) AS restaurant_score,
    COUNT(de.id) AS total_dish_entries,
    (
      SELECT dt.nombre
      FROM dish_entries de2
      JOIN dish_types dt ON dt.id = de2.tipo_plato_id
      WHERE de2.restaurant_id = r.id
      ORDER BY de2.puntuacion_general DESC NULLS LAST, de2.created_at DESC
      LIMIT 1
    ) AS best_dish_name
  FROM restaurants r
  LEFT JOIN dish_entries de ON de.restaurant_id = r.id
  GROUP BY r.id, r.nombre
`)

export const dishTypeRankings = pgView('dish_type_rankings', {
  restaurant_id: text('restaurant_id'),
  restaurant_nombre: text('restaurant_nombre'),
  categoria_id: text('categoria_id'),
  categoria_nombre: text('categoria_nombre'),
  categoria_icono: text('categoria_icono'),
  tipo_plato_id: text('tipo_plato_id'),
  tipo_plato_nombre: text('tipo_plato_nombre'),
  media_entry: real('media_entry'),
  votos: bigint('votos', { mode: 'number' }),
  media_global: real('media_global'),
  score: real('score'),
  best_photo_url: text('best_photo_url'),
}).as(sql`
  WITH entry_aggregates AS (
    SELECT
      de.restaurant_id,
      de.categoria_id,
      de.tipo_plato_id,
      AVG(de.puntuacion_general) AS media_entry,
      COUNT(*) AS votos
    FROM dish_entries de
    GROUP BY de.restaurant_id, de.categoria_id, de.tipo_plato_id
  ),
  global_averages AS (
    SELECT
      de.tipo_plato_id,
      AVG(de.puntuacion_general) AS media_global
    FROM dish_entries de
    GROUP BY de.tipo_plato_id
  )
  SELECT
    ea.restaurant_id,
    r.nombre AS restaurant_nombre,
    ea.categoria_id,
    c.nombre AS categoria_nombre,
    c.icono AS categoria_icono,
    ea.tipo_plato_id,
    dt.nombre AS tipo_plato_nombre,
    ROUND(ea.media_entry::numeric, 3) AS media_entry,
    ea.votos,
    ROUND(ga.media_global::numeric, 3) AS media_global,
    ROUND(
      (
        ((ea.media_entry * ea.votos) + (ga.media_global * 5.0)) / (ea.votos + 5.0)
      )::numeric,
      3
    ) AS score,
    (
      SELECT de2.foto_url
      FROM dish_entries de2
      WHERE de2.restaurant_id = ea.restaurant_id
        AND de2.tipo_plato_id = ea.tipo_plato_id
        AND de2.foto_url IS NOT NULL
      ORDER BY de2.puntuacion_general DESC NULLS LAST, de2.created_at DESC
      LIMIT 1
    ) AS best_photo_url
  FROM entry_aggregates ea
  JOIN global_averages ga ON ga.tipo_plato_id = ea.tipo_plato_id
  JOIN restaurants r ON r.id = ea.restaurant_id
  JOIN categories c ON c.id = ea.categoria_id
  JOIN dish_types dt ON dt.id = ea.tipo_plato_id
`)

export const categoryRankings = pgView('category_rankings', {
  restaurant_id: text('restaurant_id'),
  restaurant_nombre: text('restaurant_nombre'),
  categoria_id: text('categoria_id'),
  categoria_nombre: text('categoria_nombre'),
  categoria_icono: text('categoria_icono'),
  media_categoria: real('media_categoria'),
  votos: bigint('votos', { mode: 'number' }),
}).as(sql`
  SELECT
    de.restaurant_id,
    r.nombre AS restaurant_nombre,
    de.categoria_id,
    c.nombre AS categoria_nombre,
    c.icono AS categoria_icono,
    ROUND(AVG(de.puntuacion_general)::numeric, 3) AS media_categoria,
    COUNT(*) AS votos
  FROM dish_entries de
  JOIN restaurants r ON r.id = de.restaurant_id
  JOIN categories c ON c.id = de.categoria_id
  GROUP BY de.restaurant_id, r.nombre, de.categoria_id, c.nombre, c.icono
`)

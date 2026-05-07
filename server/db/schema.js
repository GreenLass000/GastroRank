import {
  pgTable,
  text,
  real,
  boolean,
  jsonb,
  timestamp,
  date,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const ts = (name) =>
  timestamp(name, { withTimezone: true, mode: 'string' })

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  avatar_url: text('avatar_url'),
  created_at: ts('created_at').notNull().defaultNow(),
})

export const groups = pgTable('groups', {
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
})

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
  (t) => [unique().on(t.group_id, t.user_id)],
)

export const restaurants = pgTable('restaurants', {
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
})

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  icono: text('icono').notNull(),
  scope: text('scope').notNull(),
  created_by_user_id: text('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
})

export const dishTypes = pgTable('dish_types', {
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
})

export const dishEntries = pgTable('dish_entries', {
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
    sql`ROUND(
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
    )::real`,
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
})

export const publicShareTokens = pgTable('public_share_tokens', {
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
})

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
  (t) => [unique().on(t.follower_user_id, t.followed_user_id)],
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
  (t) => [unique().on(t.dish_entry_id, t.user_id)],
)

export const comments = pgTable('comments', {
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
})

export const inspirationLists = pgTable('inspiration_lists', {
  id: text('id').primaryKey(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_default: boolean('is_default').notNull().default(false),
  created_at: ts('created_at').notNull().defaultNow(),
})

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
  (t) => [unique().on(t.list_id, t.dish_entry_id)],
)

export const recommendations = pgTable('recommendations', {
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
})

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
  (t) => [unique().on(t.user_id, t.badge_type)],
)

-- GastroRank — PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "groups" (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pareja', 'amigos', 'familia', 'otros')),
  visibility TEXT NOT NULL CHECK (visibility IN ('privado', 'público')),
  join_policy TEXT NOT NULL CHECK (join_policy IN ('código', 'aprobación', 'abierto')),
  invite_code TEXT NOT NULL UNIQUE CHECK (length(invite_code) = 6),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL,
  direccion_texto TEXT,
  google_maps_url TEXT,
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  precio_rango TEXT CHECK (precio_rango IN ('€', '€€', '€€€')),
  tags JSONB NOT NULL DEFAULT '[]',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_photo_url TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  icono TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'grupo', 'usuario')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dish_types (
  id TEXT PRIMARY KEY,
  categoria_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  alias TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'grupo', 'usuario')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dish_entries (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  categoria_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  tipo_plato_id TEXT NOT NULL REFERENCES dish_types(id) ON DELETE CASCADE,
  nombre_plato TEXT,
  sabor REAL CHECK (sabor IS NULL OR sabor BETWEEN 0 AND 10),
  textura REAL CHECK (textura IS NULL OR textura BETWEEN 0 AND 10),
  presentacion REAL CHECK (presentacion IS NULL OR presentacion BETWEEN 0 AND 10),
  calidad_precio REAL CHECK (calidad_precio IS NULL OR calidad_precio BETWEEN 0 AND 10),
  puntuacion_general REAL GENERATED ALWAYS AS (
    ROUND(
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
    )::real
  ) STORED,
  precio_plato REAL,
  notas TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  foto_url TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES "groups"(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'group', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (CASE WHEN sabor IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN textura IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN presentacion IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN calidad_precio IS NOT NULL THEN 1 ELSE 0 END) >= 1
  ),
  CHECK (visibility != 'group' OR group_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public_share_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  context TEXT NOT NULL CHECK (context IN ('mi_ranking', 'grupo', 'comunidad')),
  ranking_type TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}',
  group_id TEXT REFERENCES "groups"(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_user_id, followed_user_id),
  CHECK (follower_user_id != followed_user_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  dish_entry_id TEXT NOT NULL REFERENCES dish_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (
    reaction_type IN ('quiero_probar', 'ya_probe', 'que_hambre', 'mejorable', 'paso')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dish_entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  dish_entry_id TEXT NOT NULL REFERENCES dish_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 500),
  mentions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspiration_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspiration_list_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES inspiration_lists(id) ON DELETE CASCADE,
  dish_entry_id TEXT NOT NULL REFERENCES dish_entries(id) ON DELETE CASCADE,
  tried BOOLEAN NOT NULL DEFAULT FALSE,
  tried_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, dish_entry_id),
  CHECK (tried = FALSE OR tried_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_entry_id TEXT NOT NULL REFERENCES dish_entries(id) ON DELETE CASCADE,
  seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_user_id != to_user_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (
    badge_type IN (
      'croquetero', 'exploradora', 'foodie_visual', 'sin_fronteras',
      'referente', 'exigente', 'habitual', 'omnivoro', 'social', 'top_chef'
    )
  ),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON "groups"(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_nombre_normalizado ON restaurants(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates ON restaurants(lat, lng);
CREATE INDEX IF NOT EXISTS idx_dish_types_categoria_id ON dish_types(categoria_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_restaurant_id ON dish_entries(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_tipo_plato_id ON dish_entries(tipo_plato_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_categoria_id ON dish_entries(categoria_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_created_by_user_id ON dish_entries(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_group_id ON dish_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_dish_entries_fecha ON dish_entries(fecha);
CREATE INDEX IF NOT EXISTS idx_public_share_tokens_token ON public_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_follows_follower_user_id ON follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed_user_id ON follows(followed_user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_dish_entry_id ON reactions(dish_entry_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_dish_entry_id ON comments(dish_entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_inspiration_lists_user_id ON inspiration_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_inspiration_list_items_list_id ON inspiration_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_inspiration_list_items_dish_entry_id ON inspiration_list_items(dish_entry_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_to_user_id ON recommendations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_from_user_id ON recommendations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);

CREATE OR REPLACE VIEW restaurant_scores AS
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
GROUP BY r.id, r.nombre;

CREATE OR REPLACE VIEW dish_type_rankings AS
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
JOIN dish_types dt ON dt.id = ea.tipo_plato_id;

CREATE OR REPLACE VIEW category_rankings AS
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
GROUP BY de.restaurant_id, r.nombre, de.categoria_id, c.nombre, c.icono;

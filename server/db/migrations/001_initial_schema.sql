PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "groups" (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pareja', 'amigos', 'familia', 'otros')),
  visibility TEXT NOT NULL CHECK (visibility IN ('privado', 'público')),
  join_policy TEXT NOT NULL CHECK (join_policy IN ('código', 'aprobación', 'abierto')),
  invite_code TEXT NOT NULL UNIQUE CHECK (length(invite_code) = 6),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL,
  direccion_texto TEXT,
  google_maps_url TEXT,
  lat REAL NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng REAL NOT NULL CHECK (lng >= -180 AND lng <= 180),
  precio_rango TEXT CHECK (precio_rango IN ('€', '€€', '€€€')),
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by_user_id TEXT NOT NULL,
  cover_photo_url TEXT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  icono TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'grupo', 'usuario')),
  created_by_user_id TEXT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dish_types (
  id TEXT PRIMARY KEY,
  categoria_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  alias TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'grupo', 'usuario')),
  created_by_user_id TEXT,
  FOREIGN KEY (categoria_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dish_entries (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  categoria_id TEXT NOT NULL,
  tipo_plato_id TEXT NOT NULL,
  nombre_plato TEXT,
  sabor REAL CHECK (sabor IS NULL OR (sabor >= 0 AND sabor <= 10)),
  textura REAL CHECK (textura IS NULL OR (textura >= 0 AND textura <= 10)),
  presentacion REAL CHECK (presentacion IS NULL OR (presentacion >= 0 AND presentacion <= 10)),
  calidad_precio REAL CHECK (calidad_precio IS NULL OR (calidad_precio >= 0 AND calidad_precio <= 10)),
  puntuacion_general REAL GENERATED ALWAYS AS (
    ROUND(
      (
        COALESCE(sabor, 0) +
        COALESCE(textura, 0) +
        COALESCE(presentacion, 0) +
        COALESCE(calidad_precio, 0)
      ) /
      NULLIF(
        (sabor IS NOT NULL) +
        (textura IS NOT NULL) +
        (presentacion IS NOT NULL) +
        (calidad_precio IS NOT NULL),
        0
      ),
      1
    )
  ) STORED,
  precio_plato REAL,
  notas TEXT,
  fecha TEXT NOT NULL DEFAULT (date('now')),
  foto_url TEXT,
  created_by_user_id TEXT NOT NULL,
  group_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'group', 'public')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_plato_id) REFERENCES dish_types(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE SET NULL,
  CHECK (
    (sabor IS NOT NULL) +
    (textura IS NOT NULL) +
    (presentacion IS NOT NULL) +
    (calidad_precio IS NOT NULL) >= 1
  ),
  CHECK (visibility != 'group' OR group_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public_share_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  context TEXT NOT NULL CHECK (context IN ('mi_ranking', 'grupo', 'comunidad')),
  ranking_type TEXT NOT NULL,
  filters_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(filters_json)),
  group_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
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

CREATE VIEW IF NOT EXISTS restaurant_scores AS
SELECT
  r.id AS restaurant_id,
  r.nombre AS restaurant_nombre,
  ROUND(AVG(de.puntuacion_general), 3) AS restaurant_score,
  COUNT(de.id) AS total_dish_entries,
  (
    SELECT dt.nombre
    FROM dish_entries de2
    JOIN dish_types dt ON dt.id = de2.tipo_plato_id
    WHERE de2.restaurant_id = r.id
    ORDER BY de2.puntuacion_general DESC, de2.created_at DESC
    LIMIT 1
  ) AS best_dish_name
FROM restaurants r
LEFT JOIN dish_entries de ON de.restaurant_id = r.id
GROUP BY r.id;

CREATE VIEW IF NOT EXISTS dish_type_rankings AS
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
  ROUND(ea.media_entry, 3) AS media_entry,
  ea.votos,
  ROUND(ga.media_global, 3) AS media_global,
  ROUND(((ea.media_entry * ea.votos) + (ga.media_global * 5.0)) / (ea.votos + 5.0), 3) AS score,
  (
    SELECT de2.foto_url
    FROM dish_entries de2
    WHERE de2.restaurant_id = ea.restaurant_id
      AND de2.tipo_plato_id = ea.tipo_plato_id
      AND de2.foto_url IS NOT NULL
    ORDER BY de2.puntuacion_general DESC, de2.created_at DESC
    LIMIT 1
  ) AS best_photo_url
FROM entry_aggregates ea
JOIN global_averages ga ON ga.tipo_plato_id = ea.tipo_plato_id
JOIN restaurants r ON r.id = ea.restaurant_id
JOIN categories c ON c.id = ea.categoria_id
JOIN dish_types dt ON dt.id = ea.tipo_plato_id;

CREATE VIEW IF NOT EXISTS category_rankings AS
SELECT
  de.restaurant_id,
  r.nombre AS restaurant_nombre,
  de.categoria_id,
  c.nombre AS categoria_nombre,
  c.icono AS categoria_icono,
  ROUND(AVG(de.puntuacion_general), 3) AS media_categoria,
  COUNT(*) AS votos
FROM dish_entries de
JOIN restaurants r ON r.id = de.restaurant_id
JOIN categories c ON c.id = de.categoria_id
GROUP BY de.restaurant_id, de.categoria_id;

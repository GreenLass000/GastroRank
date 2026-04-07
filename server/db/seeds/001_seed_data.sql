PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT OR IGNORE INTO users (id, nombre, avatar_url, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Patricia', '👩', '2026-04-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'Carlos', '👨', '2026-04-01T10:05:00Z');

INSERT OR IGNORE INTO "groups" (
  id,
  nombre,
  tipo,
  visibility,
  join_policy,
  invite_code,
  created_by_user_id,
  created_at
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'La Pareja Foodie',
  'pareja',
  'privado',
  'código',
  'FD123A',
  '11111111-1111-4111-8111-111111111111',
  '2026-04-01T10:10:00Z'
);

INSERT OR IGNORE INTO group_members (id, group_id, user_id, role, status, joined_at) VALUES
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'owner', 'active', '2026-04-01T10:10:00Z'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'member', 'active', '2026-04-01T10:12:00Z');

INSERT OR IGNORE INTO restaurants (
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
) VALUES
  (
    '55555555-5555-4555-8555-555555555551',
    'Bar El Fideo',
    'bar el fideo',
    'Calle de la Cava Baja 15, Madrid',
    'https://maps.google.com/?q=40.4133,-3.7082',
    40.4133,
    -3.7082,
    '€',
    '["croquetas","taberna","centro"]',
    'Bar clásico para tapeo en La Latina.',
    '2026-04-01T11:00:00Z',
    '11111111-1111-4111-8111-111111111111',
    'https://example.com/bar-el-fideo.jpg'
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    'Bodega La Ardosa',
    'bodega la ardosa',
    'Calle de Colón 13, Madrid',
    'https://maps.google.com/?q=40.4233,-3.7032',
    40.4233,
    -3.7032,
    '€€',
    '["tortilla","croquetas","vermú"]',
    'Muy sólida para tortilla y raciones.',
    '2026-04-01T11:05:00Z',
    '11111111-1111-4111-8111-111111111111',
    'https://example.com/bodega-la-ardosa.jpg'
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    'Casa Dani',
    'casa dani',
    'Mercado de La Paz, Madrid',
    'https://maps.google.com/?q=40.4363,-3.6882',
    40.4363,
    -3.6882,
    '€€',
    '["tortilla","mercado","clásico"]',
    'Referencia para tortilla en Madrid.',
    '2026-04-01T11:10:00Z',
    '22222222-2222-4222-8222-222222222222',
    'https://example.com/casa-dani.jpg'
  );

INSERT OR IGNORE INTO categories (id, nombre, icono, scope, created_by_user_id) VALUES
  ('66666666-6666-4666-8666-666666666661', 'Croquetas', '🥟', 'global', NULL),
  ('66666666-6666-4666-8666-666666666662', 'Tortilla', '🍳', 'global', NULL),
  ('66666666-6666-4666-8666-666666666663', 'Sardinas', '🐟', 'global', NULL),
  ('66666666-6666-4666-8666-666666666664', 'Postres', '🍮', 'global', NULL);

INSERT OR IGNORE INTO dish_types (id, categoria_id, nombre, alias, scope, created_by_user_id) VALUES
  ('77777777-7777-4777-8777-777777777771', '66666666-6666-4666-8666-666666666661', 'Croqueta de jamón', 'Croqueta clásica', 'global', NULL),
  ('77777777-7777-4777-8777-777777777772', '66666666-6666-4666-8666-666666666661', 'Croqueta de boletus', NULL, 'global', NULL),
  ('77777777-7777-4777-8777-777777777773', '66666666-6666-4666-8666-666666666662', 'Tortilla española', 'Tortilla', 'global', NULL);

INSERT OR IGNORE INTO dish_entries (
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
) VALUES
  (
    '88888888-8888-4888-8888-888888888881',
    '55555555-5555-4555-8555-555555555551',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777771',
    'Croqueta cremosa de jamón',
    8.9, 8.6, 8.1, 8.8,
    2.20,
    'Muy cremosa y nada grasienta.',
    '2026-04-02',
    'https://example.com/croqueta-jamon-fideo-1.jpg',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'group',
    '2026-04-02T13:10:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888882',
    '55555555-5555-4555-8555-555555555552',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777771',
    'Croqueta de jamón de bodega',
    9.2, 8.8, 8.4, 8.5,
    2.80,
    'Muy buena intensidad de jamón.',
    '2026-04-03',
    'https://example.com/croqueta-jamon-ardosa-1.jpg',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'public',
    '2026-04-03T20:10:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888883',
    '55555555-5555-4555-8555-555555555553',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777771',
    'Croqueta de jamón del mercado',
    8.3, 8.0, 7.8, 8.2,
    2.50,
    'Correcta, algo menos intensa.',
    '2026-04-04',
    'https://example.com/croqueta-jamon-casadani-1.jpg',
    '11111111-1111-4111-8111-111111111111',
    NULL,
    'private',
    '2026-04-04T14:25:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888884',
    '55555555-5555-4555-8555-555555555551',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777772',
    'Croqueta de boletus',
    8.1, 8.4, 7.9, 8.0,
    2.60,
    'Buen punto de seta y rebozado fino.',
    '2026-04-02',
    NULL,
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'public',
    '2026-04-02T13:30:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888885',
    '55555555-5555-4555-8555-555555555552',
    '66666666-6666-4666-8666-666666666662',
    '77777777-7777-4777-8777-777777777773',
    'Tortilla jugosa',
    9.4, 9.1, 8.7, 8.9,
    4.20,
    'De las mejores del centro.',
    '2026-04-03',
    'https://example.com/tortilla-ardosa-1.jpg',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'group',
    '2026-04-03T21:00:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888886',
    '55555555-5555-4555-8555-555555555553',
    '66666666-6666-4666-8666-666666666662',
    '77777777-7777-4777-8777-777777777773',
    'Tortilla clásica de Casa Dani',
    9.5, 9.2, 8.9, 9.1,
    4.00,
    'Referencia total. Punto exacto.',
    '2026-04-04',
    'https://example.com/tortilla-casadani-1.jpg',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'public',
    '2026-04-04T14:40:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888887',
    '55555555-5555-4555-8555-555555555551',
    '66666666-6666-4666-8666-666666666662',
    '77777777-7777-4777-8777-777777777773',
    'Tortilla de barra',
    8.0, 7.8, 7.5, 8.4,
    3.20,
    'Muy buena relación calidad-precio.',
    '2026-04-02',
    NULL,
    '11111111-1111-4111-8111-111111111111',
    NULL,
    'private',
    '2026-04-02T14:00:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555552',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777772',
    'Croqueta de boletus cremosa',
    8.5, 8.7, 8.0, 8.3,
    2.90,
    'Más equilibrada que la de otros sitios.',
    '2026-04-05',
    NULL,
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'public',
    '2026-04-05T18:20:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888889',
    '55555555-5555-4555-8555-555555555551',
    '66666666-6666-4666-8666-666666666661',
    '77777777-7777-4777-8777-777777777771',
    'Croqueta de jamón de barra',
    8.7, 8.5, 8.0, 9.0,
    2.10,
    'Muy recomendable para repetir.',
    '2026-04-05',
    NULL,
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'public',
    '2026-04-05T18:45:00Z'
  ),
  (
    '88888888-8888-4888-8888-888888888890',
    '55555555-5555-4555-8555-555555555553',
    '66666666-6666-4666-8666-666666666662',
    '77777777-7777-4777-8777-777777777773',
    'Tortilla para compartir',
    9.1, 8.9, 8.6, 8.8,
    4.10,
    'Muy consistente incluso a última hora.',
    '2026-04-05',
    'https://example.com/tortilla-casadani-2.jpg',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'group',
    '2026-04-05T19:05:00Z'
  );

COMMIT;

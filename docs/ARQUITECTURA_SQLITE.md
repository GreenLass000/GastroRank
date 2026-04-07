# Arquitectura SQLite

## Objetivo
SQLite es la fuente de verdad para entidades persistentes del dominio: usuarios, grupos, miembros, restaurantes, categorías, tipos de plato, entradas de plato y enlaces públicos de compartición. `localStorage` queda reservado para estado de UI como filtros, tema o borradores temporales.

## Estructura de carpetas
- `server/db/migrations/`: esquema SQL versionado
- `server/db/seeds/`: datos de arranque reproducibles
- `server/db/data/`: base local runtime, ignorada por Git
- `scripts/db/`: comandos operativos de creación, seed, reset y verificación
- `server/app.js`: API local de lectura para que React consuma SQLite

## Archivo principal
La base local se crea en:

`server/db/data/ranking_gastronomico.sqlite`

Ese archivo no se versiona. Lo que sí se versiona es el esquema y el seed.

## Comandos
- `npm run api:dev`: levanta la API en `http://localhost:3030`
- `npm run db:init`: crea la base y aplica `001_initial_schema.sql`
- `npm run db:seed`: inserta los datos iniciales
- `npm run db:reset`: borra la base local y la reconstruye
- `npm run db:verify`: lista tablas y conteos para comprobar consistencia

## Endpoints iniciales
- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/users`
- `GET /api/groups`
- `GET /api/groupMembers`
- `GET /api/restaurants`
- `GET /api/categories`
- `GET /api/dishTypes`
- `GET /api/dishEntries`
- `POST /api/restaurants`
- `POST /api/categories`
- `POST /api/dish-types`
- `POST /api/dish-entries`

## Criterios de modelado
- Los campos del núcleo definidos en `TODO.md` deben mantenerse exactos.
- Los arrays como `tags` se almacenan como JSON en texto.
- `puntuacion_general` se calcula en la base mediante columna generada.
- Las vistas SQL deben reutilizar la fórmula oficial de ranking.
- La semilla debe dejar el proyecto listo para probar rankings y grupos desde el primer arranque.

## Regla de trabajo
Si una tarea cambia persistencia, validaciones de datos, ranking, deduplicación o seed, primero se actualiza `server/db/`, luego la capa de acceso en frontend y después la UI. Nunca al revés.

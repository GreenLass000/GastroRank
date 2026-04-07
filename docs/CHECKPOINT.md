# Checkpoint de Continuidad

## Objetivo
Este archivo sirve como memoria operativa para retomar el proyecto en otra sesión sin perder contexto. Si una futura sesión de Codex entra “fría”, debe leer este documento antes de modificar código.

## Estado actual
- Frontend base mobile-first ya montado en React/Vite.
- SQLite creada como fuente de verdad de dominio.
- API local sobre SQLite ya funcionando en `server/app.js`.
- La app ya hidrata estado desde `/api/bootstrap` con fallback al seed local si la API falla.
- Ya existe escritura real en SQLite para:
  - `POST /api/restaurants`
  - `POST /api/categories`
  - `POST /api/dish-types`
  - `POST /api/dish-entries`
- Ya existe:
  - formulario de restaurante con validación de ubicación
  - wizard de 5 pasos para añadir plato
  - cálculo en vivo de `puntuacion_general`
  - rankings derivados desde el estado compartido
  - swipe horizontal entre tipos de ranking
  - detalle por entrada/ranking en modal
  - feedback global de carga, error y éxito
  - capa transversal de filtros persistentes en `localStorage`
  - chips eliminables de filtros activos
  - contador de resultados en listas y rankings
  - dependencia `Tipo de plato` según `Categoría`
- Ya existe mapa real interactivo con Leaflet + OpenStreetMap:
  - pins reales de restaurantes
  - clustering de pins al alejar el zoom
  - detalle al tocar pin
  - long-press de 500 ms para fijar nueva ubicación
  - apertura del formulario de restaurante desde el mapa con coordenadas precargadas
  - mini mapa reutilizable dentro del alta de restaurante
  - centrado inicial por geolocalización
  - fallback a Valladolid si el usuario no concede permiso
  - CTA visible para crear restaurante desde el punto marcado
  - preferencia global de estilo de pin y override por restaurante
- Se corrigió la jerarquía visual para que el mapa no se monte sobre modal, topbar, FAB ni navegación inferior
- El formulario de restaurante ya permite:
  - usar ubicación actual
  - fijar pin con long-press en mini mapa
  - búsqueda real de lugares sobre proveedor abierto
  - sugerencias locales de restaurantes guardados como fallback de búsqueda

## Cómo arrancar el proyecto
1. `npm run db:reset`
2. `npm run api:dev`
3. `npm run dev`

Para preview:
1. `npm run build`
2. `npm run api:dev`
3. `npm run preview`

La app usa `/api` y Vite hace proxy a `127.0.0.1:3030`.

## Archivos clave
- `TODO.md`: brief y reglas finales
- `AGENTS.md`: reglas de contribución y dónde buscar
- `docs/ARQUITECTURA_SQLITE.md`: esquema y API
- `docs/CHECKLIST_TECNICO.md`: checklist de avance
- `src/providers/AppStateProvider.jsx`: estado global y mutaciones
- `server/app.js`: API local SQLite
- `src/components/forms/AddDishWizard.jsx`: flujo central de producto
- `src/components/filters/FilterPanel.jsx`: panel de filtros globales con persistencia de UI
- `src/components/forms/RestaurantForm.jsx`: alta de restaurante
- `src/components/map/MapView.jsx`: mapa Leaflet + OpenStreetMap con long-press y geocentrado inicial
- `src/components/map/RestaurantMiniMap.jsx`: mini mapa para confirmar ubicación
- `src/lib/filters.js`: normalización, aplicación y chips de filtros
- `src/lib/maps.js`: utilidades de sugerencias, proyección auxiliar y helpers de mapa

## Decisiones ya tomadas
- SQLite es la fuente de verdad de entidades persistentes.
- `localStorage` queda reservado para estado de UI.
- Todo texto visible al usuario va en español.
- No se aceptan fallos silenciosos.
- La app debe seguir usable si la API falla: se muestra error y fallback local.

## Pendiente más importante
El siguiente bloque recomendado es cerrar el resto del alta de restaurante y del flujo de imágenes:
- foto de portada por archivo o URL en restaurante
- `ImageInput` reutilizable para archivo o URL en platos
- validación mínima de formato y tamaño antes de guardar

## Qué no rehacer
- No volver a diseñar el shell principal.
- No mover SQLite fuera de `server/db`.
- No romper el modelo actual del seed y la base sin actualizar también la API y el provider.

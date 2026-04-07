# Checklist Técnico

## Objetivo
Este checklist descompone `TODO.md` y `PLAN_IMPLEMENTACION.md` en tareas concretas por archivo, módulo y componente. Si algún archivo aún no existe, debe crearse con esta estructura o una equivalente que mantenga la misma separación de responsabilidades.

## 1. Base del proyecto
- [x] `src/main.jsx`
  - [x] montar la app
  - [x] registrar providers globales
  - [ ] registrar service worker si se implementa PWA
- [x] `src/App.jsx`
  - [x] definir layout principal
  - [x] montar navegación inferior
  - [x] resolver cambio de vistas y transiciones
- [ ] `src/index.css`
  - [x] definir tokens de color obligatorios
  - [x] asegurar base mobile-first
  - [ ] incluir reglas `@media print`
- [x] `src/App.css`
  - [x] estilos del shell general
  - [x] utilidades de layout y animación

## 2. Backend SQLite y scripts
- [x] `server/db/migrations/001_initial_schema.sql`
  - [x] definir tablas núcleo según `TODO.md`
  - [x] añadir índices necesarios
  - [x] añadir vistas de ranking reutilizables
- [x] `server/db/seeds/001_seed_data.sql`
  - [x] insertar usuarios
  - [x] insertar grupo y miembros
  - [x] insertar restaurantes, categorías y tipos
  - [x] insertar 10 dish entries de prueba
- [x] `server/db/data/.gitkeep`
  - [x] mantener versionada la carpeta local de runtime sin subir el `.sqlite`
- [x] `scripts/db/init.sh`
  - [x] crear base local y aplicar esquema
- [x] `scripts/db/seed.sh`
  - [x] cargar seed reproducible
- [x] `scripts/db/reset.sh`
  - [x] recrear base de datos
- [x] `scripts/db/verify.sh`
  - [x] listar tablas y conteos básicos
- [x] `server/app.js`
  - [x] exponer endpoints de lectura desde SQLite
  - [x] devolver JSON válido para bootstrap del frontend
  - [x] manejar CORS, errores y healthcheck
- [x] `docs/ARQUITECTURA_SQLITE.md`
  - [x] documentar rutas, comandos y decisiones

## 3. Estructura recomendada a crear
- [x] `src/data/seed.js`
- [x] `src/lib/storage.js`
- [ ] `src/lib/validation.js`
- [x] `src/lib/scoring.js`
- [x] `src/lib/ranking.js`
- [x] `src/lib/filters.js`
- [x] `src/lib/maps.js`
- [ ] `src/lib/images.js`
- [x] `src/lib/format.js`
- [x] `src/hooks/useAppState.js`
- [x] `src/hooks/usePersistentState.js`
- [ ] `src/hooks/useToast.js`
- [x] `src/components/layout/BottomNav.jsx`
- [x] `src/components/layout/FloatingActionButton.jsx`
- [x] `src/components/feedback/ToastCenter.jsx`
- [x] `src/components/feedback/LoadingOverlay.jsx`
- [x] `src/components/map/MapView.jsx`
- [x] `src/components/map/Pin.jsx`
- [x] `src/components/map/RestaurantMiniMap.jsx`
- [x] `src/components/rankings/RankingList.jsx`
- [x] `src/components/rankings/RankingCard.jsx`
- [x] `src/components/filters/FilterPanel.jsx`
- [x] `src/components/forms/RestaurantForm.jsx`
- [x] `src/components/forms/AddDishWizard.jsx`
- [ ] `src/components/forms/ImageInput.jsx`
- [x] `src/components/forms/ScoreInput.jsx`
- [x] `src/screens/HomeScreen.jsx`
- [x] `src/screens/RankingsScreen.jsx`
- [x] `src/screens/MapScreen.jsx`
- [x] `src/screens/ListsScreen.jsx`
- [x] `src/screens/ProfileScreen.jsx`
- [ ] `src/screens/ReportScreen.jsx`

## 4. Estado global y persistencia
- [x] `src/lib/storage.js`
  - [x] encapsular `localStorage` para estado de UI
  - [x] envolver lecturas y escrituras en `try/catch`
- [x] `src/lib/api.js`
  - [x] timeout de peticiones
  - [x] bootstrap remoto desde API local
- [x] `src/hooks/useAppState.js`
  - [x] exponer usuarios, grupos, restaurantes, categorías, platos y filtros
  - [x] centralizar acciones de alta, edición y borrado
  - [x] mostrar feedback global
- [x] `src/data/seed.js`
  - [x] reflejar los datos que también viven en `server/db/seeds/001_seed_data.sql`

## 5. Lógica de negocio
- [ ] `src/lib/validation.js`
  - [ ] validar campos obligatorios
  - [x] bloquear restaurante sin coordenadas
  - [x] detectar duplicados
- [x] `src/lib/scoring.js`
  - [x] calcular `puntuacion_general`
  - [x] calcular media por restaurante
- [x] `src/lib/ranking.js`
  - [x] implementar fórmula oficial de ranking
  - [x] ordenar por score, votos y media
- [x] `src/lib/format.js`
  - [ ] normalizar nombres
  - [x] formatear fechas, moneda y decimales

## 6. Pantallas principales
- [x] `src/screens/HomeScreen.jsx`
  - [x] buscador hero
  - [x] últimos platos
  - [x] top por categoría
  - [x] restaurantes cercanos
- [x] `src/screens/RankingsScreen.jsx`
  - [x] contextos mi ranking, grupo y comunidad
  - [x] swipe entre tipos
  - [x] detalle por entrada
- [x] `src/screens/MapScreen.jsx`
  - [x] mapa completo
  - [x] long-press de 500 ms
  - [x] card al tocar pin
  - [x] centrado inicial por geolocalización con fallback a Valladolid
  - [x] CTA visible para crear restaurante desde el punto marcado
- [x] `src/screens/ListsScreen.jsx`
  - [x] listas filtrables de restaurantes y platos
- [x] `src/screens/ProfileScreen.jsx`
  - [x] avatar
  - [x] estadísticas
  - [x] grupos e invitaciones
  - [x] ajustes
  - [x] preferencia global de estilo de pin
- [ ] `src/screens/ReportScreen.jsx`
  - [ ] ruta `/informe`
  - [ ] versión imprimible
  - [ ] botón `window.print()`

## 7. Formularios críticos
- [ ] `src/components/forms/RestaurantForm.jsx`
  - [x] búsqueda real de lugares/autocomplete
  - [x] ubicación actual
  - [x] mini mapa
  - [x] recibir coordenadas precargadas desde mapa principal
  - [ ] foto por archivo o URL
- [x] `src/components/forms/AddDishWizard.jsx`
  - [x] paso 1 restaurante
  - [x] paso 2 categoría
  - [x] paso 3 tipo de plato
  - [x] paso 4 puntuación
  - [x] paso 5 detalles
  - [x] guardado optimista con retry
- [x] `src/components/forms/ScoreInput.jsx`
  - [x] slider 0.0–10.0
  - [x] entrada manual
  - [x] preview en vivo
- [ ] `src/components/forms/ImageInput.jsx`
  - [ ] toggle archivo o URL
  - [ ] validación de tamaño y formato
  - [ ] compresión cliente si supera 1 MB

## 8. Mapa e integraciones
- [x] `src/lib/maps.js`
  - [x] integrar Leaflet
  - [x] usar teselas OpenStreetMap
  - [x] fallback de centrado a Valladolid sin permiso de ubicación
  - [x] añadir proveedor de búsqueda/autocomplete real
- [x] `src/components/map/Pin.jsx`
  - [x] pin por score
  - [x] pin por categoría
  - [x] pin por foto
  - [x] pin por precio
  - [x] pin por score numérico
- [x] clustering y selección visual activa
- [x] preferencia global y override por restaurante del estilo de pin
- [x] ajustar `z-index` para no solapar navegación, modal ni overlays

## 9. Filtros, exportación y share
- [x] `src/components/filters/FilterPanel.jsx`
  - [x] categoría
  - [x] tipo de plato dependiente
  - [x] año
  - [x] solo con foto
  - [x] precio
  - [x] autor
  - [x] radio por zona
  - [x] puntuación mínima
- [x] persistir filtros en almacenamiento local
- [ ] crear exportación CSV
- [ ] generar token de compartir y vista pública read-only
- [ ] copiar enlace con confirmación visible

## 10. Calidad mínima antes de dar por terminado
- [ ] no hay fallos silenciosos
- [x] toda acción muestra loading, éxito o error
- [x] no hay scroll horizontal en móvil
- [x] `npm run db:verify` pasa
- [x] `npm run lint` pasa
- [x] `npm run build` pasa
- [ ] se cumple el checklist final de `TODO.md`

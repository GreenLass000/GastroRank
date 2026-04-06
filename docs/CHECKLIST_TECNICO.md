# Checklist Técnico

## Objetivo
Este checklist descompone `TODO.md` y `PLAN_IMPLEMENTACION.md` en tareas concretas por archivo, módulo y componente. Si algún archivo aún no existe, debe crearse con esta estructura o una equivalente que mantenga la misma separación de responsabilidades.

## 1. Base del proyecto
- [ ] `src/main.jsx`
  - [ ] montar la app
  - [ ] registrar providers globales
  - [ ] registrar service worker si se implementa PWA
- [ ] `src/App.jsx`
  - [ ] definir layout principal
  - [ ] montar navegación inferior
  - [ ] resolver cambio de vistas y transiciones
- [ ] `src/index.css`
  - [ ] definir tokens de color obligatorios
  - [ ] asegurar base mobile-first
  - [ ] incluir reglas `@media print`
- [ ] `src/App.css`
  - [ ] estilos del shell general
  - [ ] utilidades de layout y animación

## 2. Estructura recomendada a crear
- [ ] `src/data/seed.js`
- [ ] `src/lib/storage.js`
- [ ] `src/lib/validation.js`
- [ ] `src/lib/scoring.js`
- [ ] `src/lib/ranking.js`
- [ ] `src/lib/maps.js`
- [ ] `src/lib/images.js`
- [ ] `src/lib/format.js`
- [ ] `src/hooks/useAppState.js`
- [ ] `src/hooks/usePersistentState.js`
- [ ] `src/hooks/useToast.js`
- [ ] `src/components/layout/BottomNav.jsx`
- [ ] `src/components/layout/FloatingActionButton.jsx`
- [ ] `src/components/feedback/ToastCenter.jsx`
- [ ] `src/components/feedback/LoadingOverlay.jsx`
- [ ] `src/components/map/MapView.jsx`
- [ ] `src/components/map/Pin.jsx`
- [ ] `src/components/map/RestaurantMiniMap.jsx`
- [ ] `src/components/rankings/RankingList.jsx`
- [ ] `src/components/rankings/RankingCard.jsx`
- [ ] `src/components/filters/FilterPanel.jsx`
- [ ] `src/components/forms/RestaurantForm.jsx`
- [ ] `src/components/forms/AddDishWizard.jsx`
- [ ] `src/components/forms/ImageInput.jsx`
- [ ] `src/components/forms/ScoreInput.jsx`
- [ ] `src/screens/HomeScreen.jsx`
- [ ] `src/screens/RankingsScreen.jsx`
- [ ] `src/screens/MapScreen.jsx`
- [ ] `src/screens/ListsScreen.jsx`
- [ ] `src/screens/ProfileScreen.jsx`
- [ ] `src/screens/ReportScreen.jsx`

## 3. Estado global y persistencia
- [ ] `src/lib/storage.js`
  - [ ] guardar y leer base completa
  - [ ] versionar esquema si hace falta migración
  - [ ] envolver escrituras en `try/catch`
- [ ] `src/hooks/useAppState.js`
  - [ ] exponer usuarios, grupos, restaurantes, categorías, platos y filtros
  - [ ] centralizar acciones de alta, edición y borrado
  - [ ] mostrar feedback global
- [ ] `src/data/seed.js`
  - [ ] crear Patricia y Carlos
  - [ ] crear grupo inicial
  - [ ] crear restaurantes, categorías, tipos y 10 entradas

## 4. Lógica de negocio
- [ ] `src/lib/validation.js`
  - [ ] validar campos obligatorios
  - [ ] bloquear restaurante sin coordenadas
  - [ ] detectar duplicados
- [ ] `src/lib/scoring.js`
  - [ ] calcular `puntuacion_general`
  - [ ] calcular media por restaurante
- [ ] `src/lib/ranking.js`
  - [ ] implementar fórmula oficial de ranking
  - [ ] ordenar por score, votos y media
- [ ] `src/lib/format.js`
  - [ ] normalizar nombres
  - [ ] formatear fechas, moneda y decimales

## 5. Pantallas principales
- [ ] `src/screens/HomeScreen.jsx`
  - [ ] buscador hero
  - [ ] últimos platos
  - [ ] top por categoría
  - [ ] restaurantes cercanos
- [ ] `src/screens/RankingsScreen.jsx`
  - [ ] contextos mi ranking, grupo y comunidad
  - [ ] swipe entre tipos
  - [ ] detalle por entrada
- [ ] `src/screens/MapScreen.jsx`
  - [ ] mapa completo
  - [ ] long-press de 500 ms
  - [ ] card al tocar pin
- [ ] `src/screens/ListsScreen.jsx`
  - [ ] listas filtrables de restaurantes y platos
- [ ] `src/screens/ProfileScreen.jsx`
  - [ ] avatar
  - [ ] estadísticas
  - [ ] grupos e invitaciones
  - [ ] ajustes
- [ ] `src/screens/ReportScreen.jsx`
  - [ ] ruta `/informe`
  - [ ] versión imprimible
  - [ ] botón `window.print()`

## 6. Formularios críticos
- [ ] `src/components/forms/RestaurantForm.jsx`
  - [ ] búsqueda con Google Places
  - [ ] ubicación actual
  - [ ] mini mapa
  - [ ] foto por archivo o URL
- [ ] `src/components/forms/AddDishWizard.jsx`
  - [ ] paso 1 restaurante
  - [ ] paso 2 categoría
  - [ ] paso 3 tipo de plato
  - [ ] paso 4 puntuación
  - [ ] paso 5 detalles
  - [ ] guardado optimista con retry
- [ ] `src/components/forms/ScoreInput.jsx`
  - [ ] slider 0.0–10.0
  - [ ] entrada manual
  - [ ] preview en vivo
- [ ] `src/components/forms/ImageInput.jsx`
  - [ ] toggle archivo o URL
  - [ ] validación de tamaño y formato
  - [ ] compresión cliente si supera 1 MB

## 7. Mapa e integraciones
- [ ] `src/lib/maps.js`
  - [ ] cargar Google Maps JS API
  - [ ] cargar Places API
  - [ ] fallback si no hay `VITE_GOOGLE_MAPS_API_KEY`
- [ ] `src/components/map/Pin.jsx`
  - [ ] pin por score
  - [ ] pin por categoría
  - [ ] pin por foto
  - [ ] pin por precio
  - [ ] pin por score numérico
- [ ] clustering y selección visual activa

## 8. Filtros, exportación y share
- [ ] `src/components/filters/FilterPanel.jsx`
  - [ ] categoría
  - [ ] tipo de plato dependiente
  - [ ] año
  - [ ] solo con foto
  - [ ] precio
  - [ ] autor
  - [ ] radio por zona
  - [ ] puntuación mínima
- [ ] persistir filtros en almacenamiento local
- [ ] crear exportación CSV
- [ ] generar token de compartir y vista pública read-only
- [ ] copiar enlace con confirmación visible

## 9. Calidad mínima antes de dar por terminado
- [ ] no hay fallos silenciosos
- [ ] toda acción muestra loading, éxito o error
- [ ] no hay scroll horizontal en móvil
- [ ] `npm run lint` pasa
- [ ] `npm run build` pasa
- [ ] se cumple el checklist final de `TODO.md`

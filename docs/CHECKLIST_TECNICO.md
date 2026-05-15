# Checklist técnico del bloque frontend

## Uso
- Este checklist ejecuta `docs/PLAN_FRONTEND_MAESTRO.md`.
- Marcar cada bloque solo cuando el código, la verificación y la continuidad documental estén cerrados.
- No abrir una fase nueva sin revisar antes:
  - `docs/CHECKPOINT.md`
  - `docs/PLAN_FRONTEND_MAESTRO.md`
  - este archivo

## Estado global
- [ ] Fase 0 cerrada
- [ ] Fase 1 cerrada
- [ ] Fase 2 cerrada
- [ ] Fase 3 cerrada
- [ ] Fase 4 cerrada
- [ ] Fase 5 cerrada
- [ ] Fase 6 cerrada
- [ ] Fase 7 cerrada
- [ ] Fase 8 cerrada
- [ ] Fase 9 cerrada
- [ ] Fase 10 cerrada

## Fase 0. Continuidad documental
- [ ] `docs/PLAN_FRONTEND_MAESTRO.md` existe y es la referencia principal del bloque.
- [ ] `docs/CHECKLIST_TECNICO.md` existe y refleja el orden real de ejecución.
- [ ] `docs/CHECKPOINT.md` ya no describe el repo como “en espera”.
- [ ] `AGENTS.md` apunta al plan maestro y al checklist técnico.
- [ ] El próximo bloque recomendado en `docs/CHECKPOINT.md` coincide con la siguiente fase real.

## Fase 1. Estabilidad inmediata

### `src/components/map/MapView.jsx`
- [x] La inicialización del mapa no depende de objetos de viewport inestables.
- [x] El mapa no se destruye y recrea al mover el viewport.
- [x] `invalidateSize()` solo corre cuando toca.

### `src/lib/scoring.js`
- [x] `calculateAverageScore` ignora `null`, `undefined` y valores no finitos.
- [x] `getScoreTone` devuelve tono neutral sin nota válida.

### `src/lib/ranking.js`
- [x] El ranking de restaurantes usa categorías y tipos reales en sus lookups.

### `src/screens/MapScreen.jsx`
- [x] El score medio de restaurante se calcula una sola vez por restaurante.

### Verificación
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Prueba manual del mapa sin saltos ni reinicios al navegar

## Fase 2. Modularización base

### Providers nuevos
- [ ] Crear `src/providers/AppProviders.jsx`
- [ ] Crear `src/providers/AuthSessionProvider.jsx`
- [ ] Crear `src/providers/FiltersProvider.jsx`
- [ ] Crear `src/providers/SocialProvider.jsx`
- [ ] Crear `src/providers/AppDataProvider.jsx`

### Integración
- [ ] `src/main.jsx` usa `AppProviders`.
- [ ] `src/hooks/useAppState.js` sigue funcionando como compatibilidad temporal.
- [ ] `src/providers/AppStateProvider.jsx` deja de ser el punto único de auth, social, filtros y datos.

### Restricciones
- [ ] No se rompe la API consumida por `App.jsx` y pantallas activas durante la transición.
- [ ] No se mueven reglas de negocio a componentes puramente visuales.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Login, carga inicial y CRUD principal siguen funcionando

## Fase 3. Shell y URL

### `src/App.jsx`
- [ ] El shell se simplifica.
- [ ] La navegación y el share siguen funcionando.

### Estado en URL
- [ ] Rankings persiste contexto, grupo, modo, submodo, categoría, tipo y top.
- [ ] Comunidad persiste tab, página y filtros principales.
- [ ] Los estados efímeros se quedan fuera de URL.

### Hook
- [ ] Crear `src/hooks/useScreenQueryState.js`

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Recargar conserva el estado principal de rankings y comunidad

## Fase 4. Inicio

### `src/screens/HomeScreen.jsx`
- [ ] La búsqueda es el primer bloque útil.
- [ ] El hero editorial grande desaparece.
- [ ] Los mensajes y ayudas se compactan.

### `src/App.jsx`
- [ ] La topbar de `home` no compite con la búsqueda.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Revisión manual móvil de la jerarquía visual de `Inicio`

## Fase 5. Rankings

### UX visible
- [ ] `Mi grupo` permite elegir grupo real si hay varios.
- [ ] Las categorías usan mejor el espacio y no se rompen visualmente.
- [ ] `Informe` y `Compartir` visibles se sustituyen por `Lo que más me gusta`.
- [ ] `Lo que más me gusta` está a la derecha del bloque `Top`.
- [ ] Se abre un `ActionSheet` con `Ver informe` y `Copiar enlace`.

### Estructura
- [ ] Crear `src/hooks/useRankingsController.js`
- [ ] Crear `src/hooks/usePublicShare.js`
- [ ] `RankingsScreen` delega estado y acciones complejas al controlador.

### Share público
- [ ] El payload público no incluye `filterOrigin`.
- [ ] No se mandan datos de autoría redundantes si backend ya los resuelve por sesión.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Prueba manual de contexto, grupos, informe y copia de enlace

## Fase 6. Mapa

### `src/screens/MapScreen.jsx`
- [ ] Los controles superiores relevantes pasan a icon-only con `aria-label`.
- [ ] El draft para crear restaurante se compacta.
- [ ] Los mensajes transitorios dejan de invadir la navegación.

### `src/components/map/MapView.jsx`
- [ ] La jerarquía de overlays se mantiene correcta.

### `src/lib/maps.js`
- [ ] La búsqueda remota queda validada o se mueve a backend si hace falta.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] GPS, fallback Valladolid, long-press y selección de restaurante siguen bien

## Fase 7. Comunidad y búsqueda global

### `src/screens/ComunidadScreen.jsx`
- [ ] El hero editorial grande desaparece.
- [ ] Los filtros pasan a un trigger `Filtrar` con sheet.
- [ ] Empty states y mensajes quedan más compactos.

### `src/components/community/FilterBar.jsx`
- [ ] Se reutiliza como contenido de sheet o se reemplaza por una versión pensada para sheet.

### `src/components/search/GlobalSearchPanel.jsx`
- [ ] Incluye resultados de usuarios.
- [ ] `Buscar amigos` abre una búsqueda útil de perfiles.

### Hook
- [ ] Crear `src/hooks/useGlobalSearchIndex.js`
- [ ] La búsqueda usa índices precomputados con `Map`/`Set`.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Búsqueda de usuarios y feed de amigos revisados manualmente

## Fase 8. Accesibilidad y composición de sheets

### Componentes
- [ ] `ModalSheet` se convierte en base interna o se divide en variantes explícitas.
- [ ] Crear variantes necesarias:
  - [ ] `ActionSheet`
  - [ ] `DetailSheet`
  - [ ] `FullSheet`

### Accesibilidad
- [ ] Existe trap de foco.
- [ ] El foco vuelve al trigger al cerrar.
- [ ] Se elimina el `autoFocus` fijo del botón de cierre.
- [ ] El foco inicial se define por contexto.

### Consumidores
- [ ] Rankings usa la nueva composición de sheets.
- [ ] Búsqueda global usa la nueva composición de sheets.
- [ ] Otros consumidores principales quedan migrados.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Revisión manual con teclado de apertura, navegación y cierre

## Fase 9. Sesión y hardening

### Frontend
- [ ] `src/lib/api.js` usa `credentials: 'include'`.
- [ ] La sesión ya no depende de `authHeaders()` como vía principal.
- [ ] `src/lib/constants.js` deja preparada la retirada de `STORAGE_KEYS.authToken`.
- [ ] Crear `src/providers/AuthSessionProvider.jsx` final o completar su migración.

### Backend
- [ ] `server/app.js` emite cookie de sesión en login.
- [ ] `server/app.js` emite cookie de sesión en register.
- [ ] `server/app.js` limpia la cookie en logout.
- [ ] `server/app.js` acepta cookie como autenticación.

### Migración
- [ ] Existe fase híbrida temporal sin romper clientes actuales.
- [ ] La limpieza final de `localStorage` queda completada.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Login, recarga, `auth/me` y logout verificados

## Fase 10. Rendimiento y cierre

### Optimización
- [ ] Búsqueda global evita `.find()` repetidos.
- [ ] Rankings reduce lookups lineales repetidos.
- [ ] Comunidad reduce lookups lineales repetidos.
- [ ] Los cálculos pesados se separan por dependencias.

### Bundle
- [ ] Revisar si siguen existiendo chunks demasiado grandes tras la modularización.
- [ ] Trocear vistas pesadas adicionales si sigue habiendo coste alto.

### Continuidad
- [ ] Actualizar `docs/CHECKPOINT.md` al cerrar el bloque.
- [ ] Reflejar estado final real del plan en este checklist.
- [ ] Ajustar `AGENTS.md` si cambia el punto de entrada recomendado.

### Verificación
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Revisión manual final de `Inicio`, `Rankings`, `Mapa`, `Comunidad` y auth

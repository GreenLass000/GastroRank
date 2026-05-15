# Plan Maestro de frontend

## Resumen
- Este documento fija el orden de ejecución para aplicar los cambios detectados en:
  - `docs/audits/whole-frontend-analize-code.md`
  - `TODO.md`
  - `docs/CAMBIOS_TAB_RANKINGS.md`
  - `docs/CAMBIOS_MODAL_ANADIR_PLATO.md`
- La prioridad es corregir primero estabilidad y modularización, después UX visible por pantalla, y cerrar al final con hardening de sesión y optimización.
- No se plantea un rediseño completo. Se mantiene:
  - copy en español
  - sistema de color actual
  - stack Leaflet + OpenStreetMap
  - reglas funcionales ya cerradas en producto

## Objetivos
- Reducir el acoplamiento actual del frontend para que nuevas pantallas y fixes no dependan de un único provider monolítico.
- Aplicar los ajustes visibles pedidos en `TODO.md` sin romper los flujos ya cerrados.
- Corregir deuda técnica prioritaria del audit: foco en modales, búsqueda global, deep-linking, mapa y sesión.
- Dejar una base más mantenible para siguientes cambios sin reabrir una auditoría completa.

## Prioridad de ejecución
1. Continuidad documental y bugs bloqueantes.
2. Modularización base del estado y del shell.
3. Ajustes visibles en `Inicio`, `Rankings`, `Mapa` y `Comunidad`.
4. Endurecimiento de sesión y limpieza técnica transversal.
5. Verificación final y cierre documental.

## Decisiones cerradas
- El documento maestro principal será este archivo.
- Los documentos `docs/CAMBIOS_TAB_RANKINGS.md` y `docs/CAMBIOS_MODAL_ANADIR_PLATO.md` quedan como anexos de detalle, no como planes principales.
- `useAppState()` se mantiene temporalmente como fachada de compatibilidad mientras se separan providers.
- La migración de auth se hará en dos pasos:
  - fase híbrida con compatibilidad temporal
  - retirada final de token en `localStorage`
- El bloque `Lo que más me gusta` sustituye en rankings a la pareja visible `Informe` + `Compartir`.
- La ejecución puede solaparse entre `Fase 1`, `Fase 2` y `Fase 3` si hay ownership separado, pero el cierre sigue registrándose por fase y con verificación propia.

## Arquitectura objetivo

### Providers
- Crear un agregador `src/providers/AppProviders.jsx`.
- Separar `AppStateProvider` en dominios:
  - `AuthSessionProvider`
  - `AppDataProvider`
  - `FiltersProvider`
  - `SocialProvider`
- Mantener `ThemeProvider` como provider independiente.

### Hooks y controladores
- Mantener `useAppState()` como adaptador temporal.
- Extraer controladores por pantalla:
  - `useHomeController`
  - `useRankingsController`
  - `useMapController`
  - `useCommunityController`
- Extraer hooks compartidos:
  - `usePublicShare`
  - `useGlobalSearchIndex`
  - `useScreenQueryState`

### Sheets y composición
- Dejar de depender de `ModalSheet` como componente único con variantes implícitas.
- Mantener una base común y exponer variantes explícitas:
  - `ActionSheet`
  - `DetailSheet`
  - `FullSheet`
- Todas las variantes deben incluir:
  - trap de foco
  - restauración del foco al trigger
  - foco inicial configurable
  - cierre por `Escape`

## Fases de implementación

### Fase 0. Continuidad del repo
Objetivo:
- Dejar la documentación del nuevo bloque en un estado consistente antes de tocar código.

Cambios:
- Crear este archivo como plan maestro.
- Crear o regenerar `docs/CHECKLIST_TECNICO.md` como checklist ejecutable derivado de este plan.
- Actualizar `docs/CHECKPOINT.md` para reflejar que existe un plan activo.
- Ajustar `AGENTS.md` para que apunte a este plan y al nuevo checklist.

Criterio de cierre:
- La continuidad documental refleja un bloque activo real y una ruta clara de ejecución.
- Si `Fase 1`, `Fase 2` y `Fase 3` arrancan en paralelo, esa ejecución debe quedar reflejada en `docs/CHECKPOINT.md` y `docs/CHECKLIST_TECNICO.md`.

### Fase 1. Estabilidad inmediata
Objetivo:
- Corregir primero lo que hoy degrada navegación o comportamiento base.

Cambios:
- `src/components/map/MapView.jsx`
  - evitar destrucción y recreación del mapa en cambios de viewport
  - limitar `invalidateSize()` a momentos necesarios
- `src/lib/scoring.js`
  - excluir `null` y valores no válidos del promedio
  - devolver tono neutral cuando no haya puntuación válida
- `src/screens/MapScreen.jsx`
  - evitar cálculos duplicados de score por restaurante
- `src/lib/ranking.js`
  - dejar de pasar arrays vacíos de categorías y tipos en ranking de restaurantes

Criterio de cierre:
- El mapa deja de “temblar”, no vuelve a world view por cambios internos y los badges sin nota no aparecen en rojo.

### Fase 2. Modularización base
Objetivo:
- Romper el provider monolítico sin hacer un big bang.

Cambios:
- `src/providers/AppStateProvider.jsx`
  - extraer auth y bootstrap
  - extraer filtros, origen y pin styles
  - extraer estado social y acciones sociales
  - reducir el `value` expuesto por context
- `src/main.jsx`
  - sustituir `AppStateProvider` por `AppProviders`
- `src/hooks/useAppState.js`
  - mantener una fachada de compatibilidad mientras migran pantallas

Orden:
1. Extraer `AuthSessionProvider`
2. Extraer `FiltersProvider`
3. Extraer `SocialProvider`
4. Extraer `AppDataProvider`
5. Componer todo en `AppProviders`
6. Reapuntar consumidores gradualmente

Restricciones:
- No romper la API consumida por las pantallas hasta que la separación esté estable.
- No mover reglas de negocio de ranking o mapas a componentes visuales.

Criterio de cierre:
- El provider original deja de centralizar auth, social, filtros, geolocalización y datos CRUD en un único archivo.

### Fase 3. Shell, navegación y estado de URL
Objetivo:
- Reducir fricción de navegación y hacer que el estado importante sobreviva a recargas y enlaces.

Cambios:
- `src/App.jsx`
  - simplificar el shell
  - mantener solo navegación, rutas de share, modales globales y coordinación de pantallas
- Sincronizar en query string:
  - rankings: contexto, grupo, modo, submodo, categoría, tipo y top
  - comunidad: tab, página y filtros principales
- Mantener fuera de URL solo estados efímeros:
  - sheets abiertos
  - selección temporal
  - feedback visual

Criterio de cierre:
- Recargar ya no borra el estado principal de rankings y comunidad.

### Fase 4. Inicio
Objetivo:
- Devolver `Inicio` a un flujo utilitario.

Cambios:
- `src/screens/HomeScreen.jsx`
  - mover la búsqueda al primer bloque útil
  - eliminar el hero editorial grande
  - reducir copy secundaria
  - compactar mensajes y ayudas
- `src/App.jsx`
  - evitar que la topbar de `home` compita con la búsqueda

Criterio de cierre:
- La pantalla abre con búsqueda clara y sin duplicidad de jerarquía visual.

### Fase 5. Rankings
Objetivo:
- Completar los ajustes visibles del tab y cerrar las carencias funcionales detectadas.

Cambios funcionales:
- `src/screens/RankingsScreen.jsx`
  - añadir selector real de grupo cuando el contexto sea `Mi grupo`
  - no asumir siempre `currentGroup`
  - mantener categorías compactas con mejor uso del espacio
  - sustituir `Informe` y `Compartir` visibles por un único trigger `Lo que más me gusta`
  - ubicar ese trigger a la derecha del bloque `Top`
  - abrir desde ahí un `ActionSheet` con:
    - `Ver informe`
    - `Copiar enlace`
- `src/lib/api.js` y `src/lib/ranking.js`
  - eliminar `filterOrigin` del share público
  - evitar enviar datos de autoría si backend ya los puede inferir
- `src/hooks/usePublicShare.js`
  - centralizar token, copia y estados de feedback

Cambios de estructura:
- mover el estado complejo de rankings a `useRankingsController`
- mantener `docs/CAMBIOS_TAB_RANKINGS.md` como anexo de detalle de esta fase

Criterio de cierre:
- El usuario puede elegir grupo real, la cabecera está más compacta y la acción de informe/share queda unificada.

### Fase 6. Mapa
Objetivo:
- Hacer la pantalla más navegable y menos invasiva.

Cambios:
- `src/screens/MapScreen.jsx`
  - convertir controles superiores de estilo/filtro a icon-only con `aria-label`
  - reducir el bloque de draft de restaurante
  - evitar que el flujo de añadir restaurante robe demasiado espacio
  - compactar mensajes transitorios
- `src/components/map/MapView.jsx`
  - preservar overlays por encima del mapa y por debajo de modales globales
- `src/lib/maps.js`
  - revisar búsqueda remota; si el navegador no cumple bien la política del proveedor, mover la consulta remota a backend

Criterio de cierre:
- La interacción principal del mapa vuelve a ser explorar el mapa, no gestionar overlays grandes.

### Fase 7. Comunidad y búsqueda global
Objetivo:
- Reducir ruido visual y corregir el flujo roto de buscar amigos.

Cambios:
- `src/screens/ComunidadScreen.jsx`
  - eliminar hero editorial grande
  - compactar mensajes y empty states
  - sustituir el panel de filtros siempre visible por trigger `Filtrar` + sheet
- `src/components/community/FilterBar.jsx`
  - evolucionar a contenido de sheet, no barra persistente grande
- `src/components/search/GlobalSearchPanel.jsx`
  - añadir resultados de usuarios
  - permitir que `Buscar amigos` abra una búsqueda útil de perfiles
  - optimizar búsquedas con índices precomputados
- `src/hooks/useGlobalSearchIndex.js`
  - construir `Map` y colecciones normalizadas de:
    - usuarios
    - restaurantes
    - tipos de plato
    - entradas
    - categorías

Criterio de cierre:
- `Buscar amigos` deja de ser un CTA roto y los filtros ya no ocupan demasiado espacio fijo.

### Fase 8. Accesibilidad y composición de sheets
Objetivo:
- Corregir el problema transversal de foco y mejorar la composición.

Cambios:
- `src/components/layout/ModalSheet.jsx`
  - convertirlo en base interna o dividirlo en variantes explícitas
  - eliminar `autoFocus` fijo en botón de cerrar
  - implementar trap de foco
  - devolver foco al disparador
- actualizar consumidores:
  - `GlobalSearchPanel`
  - filtros de rankings
  - futuros sheets de acciones y detalle

Criterio de cierre:
- Los sheets son navegables con teclado y no fuerzan foco incorrecto en móvil.

### Fase 9. Sesión y hardening
Objetivo:
- Reducir el riesgo de exposición de sesión por `localStorage`.

Cambios frontend:
- `src/lib/api.js`
  - usar `credentials: 'include'`
  - dejar de depender de `authHeaders()` como camino principal
- `src/lib/constants.js`
  - retirar `STORAGE_KEYS.authToken` al cierre de la migración
- `src/providers/AuthSessionProvider.jsx`
  - inicializar sesión con `auth/me` vía cookie

Cambios backend:
- `server/app.js`
  - emitir cookie `HttpOnly` de sesión en login y register
  - limpiar cookie en logout
  - permitir autenticación por cookie durante la migración
  - retirar bearer como mecanismo principal cuando la transición esté cerrada

Estrategia:
1. compatibilidad híbrida temporal
2. frontend ya funcionando con cookie
3. limpieza final de `localStorage`

Criterio de cierre:
- El frontend deja de almacenar la sesión persistente en `localStorage`.

### Fase 10. Rendimiento y limpieza final
Objetivo:
- Quitar trabajo innecesario por render y dejar cerrada la deuda visible del audit.

Cambios:
- sustituir `.find()` repetidos por `Map`/`Set` en:
  - búsqueda global
  - comunidad
  - rankings
  - detalles que recorren colecciones repetidamente
- separar cálculos pesados por dependencias independientes
- mantener lazy loading en piezas pesadas y revisar si hace falta trocear más el bundle

Criterio de cierre:
- El input de búsqueda sigue fluido y el coste de recomputación cae en las pantallas más grandes.

## Archivos principales implicados
- `src/main.jsx`
- `src/App.jsx`
- `src/providers/AppStateProvider.jsx`
- `src/hooks/useAppState.js`
- `src/screens/HomeScreen.jsx`
- `src/screens/RankingsScreen.jsx`
- `src/screens/MapScreen.jsx`
- `src/screens/ComunidadScreen.jsx`
- `src/components/layout/ModalSheet.jsx`
- `src/components/search/GlobalSearchPanel.jsx`
- `src/components/community/FilterBar.jsx`
- `src/components/map/MapView.jsx`
- `src/lib/api.js`
- `src/lib/maps.js`
- `src/lib/ranking.js`
- `src/lib/scoring.js`
- `server/app.js`

## Validación por fase
- En cada fase:
  - `npm run lint`
  - `npm run build`
- Verificación manual mínima:
  - auth
  - búsqueda
  - rankings
  - mapa
  - comunidad
  - cierre y apertura de sheets

## Escenarios obligatorios de prueba
- Login, recarga, `auth/me` y logout.
- `Inicio` con búsqueda como primer bloque visible.
- `Rankings` con:
  - cambio de contexto
  - selección de grupo
  - deep-linking por URL
  - apertura de `Lo que más me gusta`
  - copia de enlace público
- `Mapa` con:
  - GPS disponible
  - GPS denegado y fallback Valladolid
  - long-press para nueva ubicación
  - ficha de restaurante
  - overlays sin bloquear el mapa en exceso
- `Comunidad` con:
  - pestañas `Explorar` y `Amigos`
  - filtros en sheet
  - búsqueda real de usuarios desde `Buscar amigos`
- Navegación por teclado y foco correcto en sheets.

## Criterios de cierre del bloque
- Existe modularización real del estado y no solo reorganización cosmética.
- Los cambios visibles de `TODO.md` están aplicados en `Rankings`, `Mapa` y `Comunidad`.
- El flujo de `Buscar amigos` funciona de verdad.
- El mapa no se reinicializa ni se vuelve inestable al navegar.
- El share público de rankings no filtra geolocalización del autor.
- La sesión persistente deja de depender de `localStorage`.
- El repo cierra con documentación de continuidad actualizada.

## Riesgos a vigilar
- Romper demasiados consumidores al partir `AppStateProvider`.
- Introducir regresiones en share público o rankings al mover lógica a hooks.
- Mezclar la migración de sesión con cambios visuales demasiado pronto.
- Hacer un refactor demasiado amplio sin cerrar por fases verificables.

## Regla de ejecución
- No mezclar todas las fases en un único commit grande.
- Implementar y verificar por bloques cerrados.
- Antes de cada bloque nuevo:
  - revisar `docs/CHECKPOINT.md`
  - revisar este plan
  - actualizar `docs/CHECKLIST_TECNICO.md` si cambia el orden o el estado real

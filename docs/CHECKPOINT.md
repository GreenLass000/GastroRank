# CHECKPOINT

## Fecha
- 2026-05-15

## Estado actual
El repo ya no está en espera.

Estado real de continuidad:

- existe un nuevo bloque activo de frontend
- el documento rector del bloque es `docs/PLAN_FRONTEND_MAESTRO.md`
- el checklist ejecutable del bloque es `docs/CHECKLIST_TECNICO.md`
- el alcance aprobado mezcla:
  - modularización del estado y shell
  - fixes UX visibles de `TODO.md`
  - deuda técnica prioritaria del audit
  - hardening de sesión por fases

Base ya existente que se debe preservar mientras avanza el bloque:

- autenticación operativa con registro, login por `usuario o correo`, `auth/me`, cambio de contraseña y logout
- backend PostgreSQL + Drizzle funcionando
- feed social, follows, recomendaciones, listas, comentarios, reacciones y logros ya implementados
- uploads reales de imágenes implementados
- paginación real del feed implementada
- `Inicio`, `Rankings`, `Mapa`, `Comunidad` y `Perfil` ya funcionales, aunque con deuda estructural y UX pendiente

Cambios recientes ya aplicados:

- rediseño fuerte de `AuthScreen` con onboarding/carrusel y formularios separados
- la pantalla de login ya no hereda el layout con scroll de la app autenticada
- el login ahora respeta el tema activo real de la app
- hotfix importante de privacidad/social:
  - `/api/bootstrap` ya no es pública
  - el bootstrap ya no entrega todas las valoraciones ni todos los datos sociales sin filtrar
  - se bloquearon lecturas genéricas sensibles en backend
  - se añadió búsqueda segura de usuarios en `/api/users/search`
  - `GlobalSearchPanel` ya busca usuarios reales y permite seguir/dejar de seguir
- avance técnico en `Fase 1. Estabilidad inmediata`:
  - `calculateAverageScore` ya ignora `null`, `undefined` y valores no finitos
  - `MapView` evita recentrados redundantes y el mini mapa prioriza el punto enfocado/seleccionado
  - el ranking de restaurantes usa una entrada representativa real para categoría/tipo
  - `MapScreen` deja de regenerar pins solo para sobrescribir el mismo `pinStyle`
- avance estructural en `Fase 2. Modularización base`:
  - `src/main.jsx` ya monta `AppProviders`
  - `AuthSessionProvider`, `FiltersProvider`, `AppDataProvider` y `SocialProvider` ya existen
  - `AppStateProvider` ya actúa como fachada de compatibilidad en vez de concentrar todo el estado
  - `useAppState()` se mantiene estable para los consumidores actuales
- avance funcional en `Fase 3. Shell, navegación y estado de URL`:
  - `App.jsx` ya persiste `screen` en URL para vistas autenticadas
  - `useScreenQueryState.js` ya centraliza lectura/escritura tipada sobre query string
  - `RankingsScreen` ya persiste contexto, grupo efectivo, modo, submodo, categoría, tipo y top
  - `ComunidadScreen` ya persiste tab, página y filtros principales
- avance express relevante en social/comunidad, parcialmente alineado con `Fase 7. Comunidad y búsqueda global`:
  - la pestaña inferior ahora muestra `Comunidad` en vez de `Explorar`
  - `Comunidad` y `Perfil` ya exponen entrada por código a grupos
  - crear grupo, unirse con código y solicitudes pendientes ya funcionan con persistencia real
  - grupos ya permiten:
    - añadir miembros
    - aprobar o rechazar solicitudes
    - cambiar rol `member/admin`
    - expulsar miembros
    - salir del grupo
    - transferir ownership
  - `GlobalSearchPanel` ya devuelve usuarios y `Buscar amigos` abre un flujo útil
  - comentarios de reseñas ya permiten edición y borrado del propio comentario
  - las reseñas ya no son editables por usuarios distintos al autor ni en backend ni en UI visible
  - sigue pendiente cerrar la parte visual/estructural de `Fase 7`:
    - mover filtros a sheet
    - reemplazar la `FilterBar` persistente
    - crear `useGlobalSearchIndex.js`
    - validar manualmente el flujo completo social

## Estado de continuidad
Sí hay un bloque activo real y ya no está solo en definición documental.

Bloque activo:
- plan maestro frontend
- prioridad alta en modularización, mapas, rankings, comunidad, búsqueda global y sesión
- `Fase 0` ya está cerrada a nivel documental
- `Fase 1`, `Fase 2` y `Fase 3` están abiertas en ejecución paralela
- no se debe marcar cierre de `Fase 1`, `Fase 2` o `Fase 3` hasta que cada una complete su propia verificación
- `Fase 2` y `Fase 3` ya tienen implementación en código y verificación `lint`/`build`, pero siguen pendientes de prueba manual

Fases activas aprobadas:
- `Fase 1. Estabilidad inmediata`
- `Fase 2. Modularización base`
- `Fase 3. Shell, navegación y estado de URL`
- sigue existiendo además un adelanto parcial no secuencial sobre `Fase 7. Comunidad y búsqueda global` por petición express del usuario

Regla actual:
- no volver a describir el repo como “cerrado” hasta que este bloque termine de verdad
- no reabrir auditorías nuevas mientras el plan maestro siga vigente salvo petición explícita
- mientras siga la ejecución paralela de `Fase 1` a `Fase 3`, coordinar continuidad y checklist antes de marcar cierres

## Cómo retomar
Si se retoma el trabajo en una sesión futura:

1. leer este archivo
2. leer `docs/PLAN_FRONTEND_MAESTRO.md`
3. leer `docs/CHECKLIST_TECNICO.md`
4. leer `TODO.md`
5. identificar qué fase abierta (`Fase 1`, `Fase 2` o `Fase 3`) está bajo ownership en esa sesión
6. ejecutar solo el bloque de esa fase sin revertir cambios ajenos

## Próximo paso por defecto
El siguiente paso natural es:
- ejecutar prueba manual dirigida de `Fase 1`, `Fase 2` y `Fase 3`:
  - `Fase 1`: mapa sin saltos, sin world view inesperado y mini mapa estable
  - `Fase 2`: login, carga inicial, CRUD principal y flujos sociales siguen vivos tras la separación de providers
  - `Fase 3`: recargar conserva estado principal de `Rankings` y `Comunidad`, y el share público sigue abriendo bien
- validar manualmente el bloque express de `Comunidad`:
  - unirse con código
  - solicitud pendiente
  - aprobar/rechazar
  - cambio de rol
  - salida del grupo
  - transferencia de ownership
  - comentarios propios editar/borrar
- después, cerrar cada fase de forma independiente según verificación real antes de avanzar el estado global del checklist

Antes de volver al refactor planificado conviene validar manualmente:

- que un usuario no ve listas ni valoraciones privadas ajenas
- que `Buscar amigos` devuelve usuarios y permite seguir/dejar de seguir
- que `Comunidad`, `Perfil`, seguidores, seguidos y recomendaciones siguen funcionando tras el recorte de bootstrap
- que el login, `auth/me`, logout y la carga inicial siguen bien tras la separación en providers
- que recargar en `Rankings` y `Comunidad` conserva el estado reflejado en query string
- que el alta en grupos por código y las solicitudes pendientes sobreviven a recarga
- que transferir ownership bloquea la salida del owner hasta completar el traspaso

## Archivos de referencia
- `AGENTS.md`
- `TODO.md`
- `docs/PLAN_FRONTEND_MAESTRO.md`
- `docs/CHECKLIST_TECNICO.md`
- `docs/audits/whole-frontend-analize-code.md`
- `docs/CAMBIOS_TAB_RANKINGS.md`
- `docs/CAMBIOS_MODAL_ANADIR_PLATO.md`
- `server/app.js`
- `src/providers/AppStateProvider.jsx`
- `src/App.jsx`
- `src/screens/AuthScreen.jsx`
- `src/components/search/GlobalSearchPanel.jsx`
- `src/screens/ComunidadScreen.jsx`
- `src/screens/ProfileScreen.jsx`
- `src/components/details/EntityDetailSheet.jsx`
- `src/components/community/EntryDetailModal.jsx`

## Nota
Los anexos viejos siguen valiendo como detalle de ejecución, pero la prioridad y el orden oficial están ahora en:
- `docs/PLAN_FRONTEND_MAESTRO.md`
- `docs/CHECKLIST_TECNICO.md`

La ejecución actual no es estrictamente lineal:
- `Fase 0` está cerrada
- `Fase 1`, `Fase 2` y `Fase 3` pueden avanzar en paralelo con owners distintos

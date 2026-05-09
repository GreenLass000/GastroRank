# CHECKPOINT

## Fecha
- 2026-04-11
- 2026-05-05
- 2026-05-07
- 2026-05-10

## Estado general
Continuidad recuperada sin `docs/CHECKLIST_TECNICO.md` disponible en el repo.

Estado actual más relevante:

- Fase 1 de `docs/PLAN_COMPLETION.md`: implementada en código
- autenticación básica operativa con registro, login por `usuario o correo`, `auth/me`, cambio de contraseña y logout sobre `server/app.js`
- `AppStateProvider` ya no usa `state.users[0]` como sesión fuente; ahora valida token persistido y hace bootstrap tras autenticación
- nueva pantalla `AuthScreen` añadida y `App.jsx` ya bloquea la app privada cuando no hay sesión
- `ProfileScreen` ya expone bloque `Cuenta`, cambio de contraseña, cierre de sesión y métricas seguras sin `NaN`
- `ProfileScreen` ya no rompe si la sesión todavía no está hidratada; los accesos a `currentUser.id` quedaron endurecidos
- esquema PostgreSQL y Drizzle actualizados con `email`, `password_hash` y `bio` en `users`
- `server/db/init.postgres.sql` ya inicializa PostgreSQL sin error en la vista `dish_type_rankings`
- stack Docker verificado en esta sesión con puertos publicados:
  - frontend `http://localhost:4444`
  - api `http://localhost:3333`

- rediseño del modal `Añadir plato`: implementado en código según `docs/CAMBIOS_MODAL_ANADIR_PLATO.md`
- rediseño de la pestaña `Rankings`: implementado en código según `docs/CAMBIOS_TAB_RANKINGS.md`
- rediseño refinado de la pestaña `Mapa`: implementado en código según el último prompt de ajustes
- Fase 1 de `.claude/plans/prancy-splashing-sparkle.md`: implementada en esquema SQLite y aplicada sobre la base local
- Fase 2 de `.claude/plans/prancy-splashing-sparkle.md`: endpoints backend implementados en `server/app.js`
- Fase 3 de `.claude/plans/prancy-splashing-sparkle.md`: cliente API implementado en `src/lib/api.js`
- Fase 4 de `.claude/plans/prancy-splashing-sparkle.md`: estado global, métodos y derivados implementados en `src/providers/AppStateProvider.jsx`
- Fase 5 de `.claude/plans/prancy-splashing-sparkle.md`: pantalla `Comunidad` y subcomponentes implementados en `src/screens/ComunidadScreen.jsx` y `src/components/community/`
- Fase 6 de `.claude/plans/prancy-splashing-sparkle.md`: rediseño principal de `Perfil` implementado en `src/screens/ProfileScreen.jsx` y `src/App.css`
- Fase 7 de `.claude/plans/prancy-splashing-sparkle.md`: navegación cerrada con `Comunidad`, compatibilidad legado `lists` y archivado explícito de `ListsScreen`
- Fase 8 de `.claude/plans/prancy-splashing-sparkle.md`: lógica final de logros implementada con badges definitivos, cola de toast y marcado `notified`
- Fase 9 de `.claude/plans/prancy-splashing-sparkle.md`: implementada de forma parcial pero funcional
- `docs/UX_REDESIGN.md`: aplicado de forma inicial en código para shell, tema claro/oscuro/sistema, navegación reordenada y pantallas principales (`Auth`, `Inicio`, `Explorar`, `Perfil`, `ModalSheet`)
- `RankingsScreen.jsx` ya no depende de `filteredRankingContexts`
- detalle de filas en `Rankings` migrado de `ModalSheet` a expansión inline compacta
- siguiente bloque natural para ese plan: verificación con Node y cierre de los puntos pendientes de Fase 9

Cobertura actual de Fase 9 ya dejada en código:

- `server/app.js` exige `Content-Type: application/json` en `POST`/`PUT`
- rate limiting básico por IP añadido en la API local con respuesta `429`
- validación de `mentions` endurecida para comentarios
- feed `Explorar` sigue restringido a `visibility='public'`
- feed `Amigos` ahora exige follow mutuo y solo deja pasar entradas `public` o `group` con grupo compartido activo
- recomendaciones restringidas a follows mutuos tanto al crear como al leer inbox
- `/api/bootstrap` ya no arrastra por defecto follows, reactions, comments, listas, recomendaciones y logros
- `Comunidad` y `Perfil` cargan esos bloques sociales en diferido
- `AppStateProvider` memoiza `buildDerivedState()` para evitar recomputación completa en cada render

Lo que significa este estado:

- la parte ya implementada de Fase 9 está operativa en código y cambia comportamiento real
- no se considera Fase 9 cerrada porque aún faltan algunos puntos del plan original
- no hay que rehacer lo ya hecho; solo validar con Node y rematar pendientes concretos
- la nueva prioridad natural después de esta sesión es verificar Fase 1 con Node (`lint`, `build`) y luego seguir con la Fase 2 de `docs/PLAN_COMPLETION.md`

## Hecho en esta línea de trabajo

### Modal `Añadir plato`
Archivos tocados:

- `src/components/forms/AddDishWizard.jsx`
- `src/components/forms/ScoreInput.jsx`
- `src/components/forms/ImageInput.jsx`
- `src/App.css`

Resultado actual:

- wizard reordenado a 4 pasos:
  - `Nombre y categoría`
  - `Puntuación`
  - `Restaurante`
  - `Detalles`
- paso 1 resuelve `tipo_plato_id` reutilizando o creando tipo de plato
- paso 2 compactado y bloqueado hasta mover al menos un slider
- paso 3 usa restaurantes cercanos, distancia visible y `Mostrar más`
- paso 4 elimina `Nombre libre del plato`
- foto del plato con:
  - `📷 Hacer foto`
  - `🖼️ Elegir de la galería`
- añadido `peek` visual del siguiente paso

### Rankings — paso 1
Archivos tocados:

- `src/screens/RankingsScreen.jsx`
- `src/components/layout/SectionHeader.jsx`
- `src/App.css`
- `docs/CAMBIOS_TAB_RANKINGS.md`

Resultado actual:

- eliminado hero/tagline de `Rankings`
- eliminado contador de resultados
- eliminado hint visual de swipe
- botón `Filtrar` sustituido por icon-only
- `SectionHeader` admite acción custom con `aria-label`

### Rankings — paso 2
Archivos tocados:

- `src/screens/RankingsScreen.jsx`
- `src/App.css`

Resultado actual:

- selector `Mi ranking / Mi grupo / Comunidad` compactado con estilo propio de `Rankings`
- chips de contexto a `12px` con padding reducido
- estado activo morado sin reutilizar `.pill-button` ni `.chip--active`
- lógica de selección de contexto intacta

### Rankings — paso 3
Archivos tocados:

- `src/screens/RankingsScreen.jsx`
- `src/components/rankings/RankingList.jsx`
- `src/App.css`

Resultado actual:

- añadido selector inline `Top N` con opciones `5 / 10 / 25 / 50`
- valor por defecto fijado en `10`
- el límite ya vive en `RankingsScreen.jsx`
- `RankingList.jsx` deja de cortar internamente a `5`

### Rankings — pasos 4 a 7
Archivos tocados:

- `src/screens/RankingsScreen.jsx`
- `src/components/rankings/RankingList.jsx`
- `src/components/rankings/RankingCard.jsx`
- `src/lib/ranking.js`
- `src/lib/constants.js`
- `src/providers/AppStateProvider.jsx`
- `src/App.css`
- `docs/CAMBIOS_TAB_RANKINGS.md`

Resultado actual:

- selector legacy sustituido por tres modos reales:
  - `Por categoría`
  - `Por tipo de plato`
  - `Global`
- `Global` ahora expone sub-vistas:
  - `Por plato`
  - `Por categoría`
  - `Por restaurante`
- modo `Por categoría`:
  - categorías ordenadas alfabéticamente
  - selector subordinado de tipos de plato
  - ranking por restaurante con promedio simple del subconjunto filtrado
- modo `Por tipo de plato`:
  - búsqueda en tiempo real
  - recientes persistidos en `localStorage`
  - ranking por restaurante con promedio simple del subconjunto filtrado
- modo `Global`:
  - ranking por plato usando `dishType.nombre` como fuente principal
  - ranking global por categoría
  - ranking global por restaurante con fórmula Bayesian average × `log(n)`
- `RankingCard` compactada para filas densas
- `RankingList` soporta expansión inline por fila
- el detalle local de `Rankings` ya no abre `ModalSheet`

### Mapa — refinado de UX
Archivos tocados:

- `src/screens/MapScreen.jsx`
- `src/components/map/MapView.jsx`
- `src/providers/AppStateProvider.jsx`
- `src/lib/constants.js`
- `src/App.css`

Resultado actual:

- eliminados títulos, labels y cajas auxiliares antiguas de `Mapa`
- buscador superior nuevo para zona/barrio/lugar con sugerencias locales + externas
- mapa convertido en elemento dominante con botón flotante `Pantalla completa`
- botón flotante `Mi ubicación` que recentra en GPS/fallback actual
- contador flotante `X restaurantes en esta zona` reactivo al viewport
- tap en pin abre popup mínimo con nombre, score y `Ver más →`
- onboarding one-shot persistido en `localStorage`
- selector de pin rehecho con 4 estilos:
  - `Nombre`
  - `Categoría`
  - `Precio`
  - `Puntuación`
- estilo por defecto cambiado a `Puntuación`
- bottom sheet compacto para restaurante seleccionado con:
  - nombre
  - score + número de platos
  - distancia desde posición actual
  - mejor plato
  - `Ver detalle`
  - `Cómo llegar`
- lista integrada como bottom sheet con preview colapsada y dos secciones:
  - `Restaurantes que ves en el mapa`
  - `Otros restaurantes cerca`
- la lista usa tarjetas con tinte morado claro y orden por distancia al centro actual del mapa
- la lógica de long-press para crear restaurante se mantiene

### Perfil — Fase 6
Archivos tocados:

- `src/screens/ProfileScreen.jsx`
- `src/App.css`

Resultado actual:

- `ProfileScreen` rehecha como pantalla modular y mobile-first
- header nuevo con:
  - avatar editable
  - nombre
  - chip de nivel
  - copy de perfil
  - stats de `Platos / Restaurantes / Grupos`
  - acceso a `Seguidores / Siguiendo`
- bloque de grupo activo con acceso real al detalle del grupo o creación si no existe
- fila de logros recientes + sheet de `Logros y nivel`
- sección colapsable `Mis estadísticas` con 7 métricas derivadas del historial real
- sección `Mis platos` con:
  - filtros rápidos
  - filtro por categoría
  - tarjetas compactas
  - paginación incremental `Ver más`
- sección `Mis grupos` con:
  - tarjetas enriquecidas
  - avatares de miembros
  - compartir código de invitación
  - acceso al detalle real del grupo
- sección `Mis listas` con:
  - creación de listas
  - cards con miniaturas
  - sheet de detalle
  - acciones reales `Ya lo probé / Marcar pendiente / Quitar`
- bloque `Compartir mi ranking` con:
  - selector de contenido
  - selector de top
  - selector de contexto
  - preview
  - copiar enlace / compartir vía Web Share cuando exista soporte
- ajustes colapsables con:
  - edición real de perfil
  - pin por defecto
  - exportación CSV
  - acceso al catálogo editable

### Navegación / cierre de `Listas` — Fase 7
Archivos tocados:

- `src/App.jsx`
- `src/lib/constants.js`
- `src/screens/ListsScreen.jsx`

Resultado actual:

- navegación inferior consolidada con `Comunidad` como pestaña real
- icono de `Comunidad` actualizado a `🌍`
- cualquier referencia legado a `lists` se normaliza a `community`
- `ListsScreen` ya no aparenta ser una pantalla principal activa
- `ListsScreen` queda archivada como pantalla de compatibilidad con CTA a `Comunidad` y `Perfil`
- exportación CSV y listas guardadas siguen viviendo en `Perfil`

### Logros automáticos — Fase 8
Archivos tocados:

- `src/lib/achievements.js`
- `src/providers/AppStateProvider.jsx`
- `src/lib/api.js`
- `server/app.js`
- `server/db/migrations/001_initial_schema.sql`
- `src/screens/ProfileScreen.jsx`
- `src/App.css`

Resultado actual:

- catálogo único de logros compartido entre frontend y backend
- badges finales activos:
  - `Croquetero/a`
  - `Explorador/a`
  - `Foodie visual`
  - `Sin fronteras`
  - `Referente`
  - `Exigente`
  - `Habitual`
  - `Omnívoro/a`
  - `Social`
  - `Top Chef`
- `createDishEntry()` ya evalúa condiciones reales de Fase 8 tras guardar
- añadido marcado persistente `notified=true` para evitar toasts repetidos
- cola de notificaciones de logro implementada sobre `toast`
- nuevo tono visual `achievement` para el toast de desbloqueo
- `ProfileScreen` ya consume el nuevo catálogo de badges

## Pendiente inmediato

La siguiente sesión debería centrarse en verificación o ajustes puntuales:

1. validar en navegador Docker:
- login con `usuario`
- login con `correo`
- registro con `usuario` único
- acceso a `Perfil` tras hidratación inicial
2. si se cambia `server/db/init.postgres.sql`, recrear PostgreSQL con:
- `docker compose down -v`
- `docker compose up --build -d`
3. si se retoma el plan de Comunidad + Perfil, cerrar Fase 9 rematando:
- paginación real a nivel SQLite en feed
- revisión de `execFile/sqlite3` para parametrización más fuerte en escrituras
- carga de avatar/imagen con pipeline real
- posible división de estilos de `App.css`
4. si no, revisar en móvil:
- buscador de zona en `Mapa`
- popup mínimo sobre pin
- `Pantalla completa`
- `Mi ubicación`
- onboarding one-shot
- bottom sheet de detalle del restaurante
- lista integrada colapsada/expandida
- cambio de contexto
- modo `Por categoría`
- modo `Por tipo de plato`
- sub-vistas de `Global`
- expansión inline
- header de `Perfil`
- logros + sheet
- filtros de `Mis platos`
- compartir grupo
- detalle de `Mis listas`
- bloque `Compartir mi ranking`
- navegación inferior con `🌍 Comunidad`
- compatibilidad legado si reaparece algún acceso a `lists`
- desbloqueo de logros con toast especial
5. corregir solo si aparece regresión visual o de datos

## Riesgos / decisiones abiertas

- `filteredRankingContexts` sigue existiendo en el provider, pero `RankingsScreen.jsx` ya deriva sus vistas desde `filteredDishEntries` + builders locales
- `Informe` y `Compartir` siguen funcionando, pero su representación impresa todavía se apoya en builders legacy por `typeKey`
- el repo sigue sin `docs/CHECKLIST_TECNICO.md`
- el nuevo buscador de `Mapa` usa búsqueda externa equivalente a Places cuando la red lo permite; falta validarlo en entorno real
- para aplicar los nuevos `badge_type` en SQLite real hará falta `npm run db:reset` cuando el entorno vuelva a tener Node disponible
- Fase 9 no está cerrada todavía, pero tampoco está pendiente entera
- el login ahora acepta `payload.identifier` y mantiene compatibilidad con `payload.email`; si se toca auth otra vez, preservar esa compatibilidad
- Docker ya no debe asumir puertos por defecto:
  - frontend externo `4444`
  - api externa `3333`
  - api interna entre contenedores `3030`
- ya cubierto:
  - rate limit básico
  - `Content-Type` obligatorio en escrituras HTTP
  - enforcement de visibilidad y follows mutuos
  - lazy-load social en `Comunidad` y `Perfil`
  - memoización de derivados en el provider
- pendiente:
  - paginación SQL real
  - uploads
  - posible partición de `App.css`
  - endurecimiento adicional de escrituras SQLite

## Limitación del entorno

En esta sesión sí se ha podido ejecutar verificación con:

- `npm run lint`
- `npm run build`

Sí se ha podido ejecutar:

- `docker compose down -v`
- `docker compose up --build -d`
- validación de logs de PostgreSQL para confirmar creación limpia de tablas, índices y vistas

## Archivos que conviene abrir primero al retomar

- `docs/CHECKPOINT.md`
- `docs/CAMBIOS_TAB_RANKINGS.md`
- `server/app.js`
- `src/screens/ProfileScreen.jsx`
- `src/screens/ComunidadScreen.jsx`
- `src/lib/achievements.js`
- `src/lib/api.js`
- `src/providers/AppStateProvider.jsx`

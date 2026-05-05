# CHECKPOINT

## Fecha
- 2026-04-11
- 2026-05-05

## Estado general
Continuidad recuperada sin `docs/CHECKLIST_TECNICO.md` disponible en el repo.

Estado actual más relevante:

- rediseño del modal `Añadir plato`: implementado en código según `docs/CAMBIOS_MODAL_ANADIR_PLATO.md`
- rediseño de la pestaña `Rankings`: implementado en código según `docs/CAMBIOS_TAB_RANKINGS.md`
- rediseño refinado de la pestaña `Mapa`: implementado en código según el último prompt de ajustes
- Fase 1 de `.claude/plans/prancy-splashing-sparkle.md`: implementada en esquema SQLite y aplicada sobre la base local
- Fase 2 de `.claude/plans/prancy-splashing-sparkle.md`: endpoints backend implementados en `server/app.js`
- Fase 3 de `.claude/plans/prancy-splashing-sparkle.md`: cliente API implementado en `src/lib/api.js`
- Fase 4 de `.claude/plans/prancy-splashing-sparkle.md`: estado global, métodos y derivados implementados en `src/providers/AppStateProvider.jsx`
- Fase 5 de `.claude/plans/prancy-splashing-sparkle.md`: pantalla `Comunidad` y subcomponentes implementados en `src/screens/ComunidadScreen.jsx` y `src/components/community/`
- Fase 6 de `.claude/plans/prancy-splashing-sparkle.md`: rediseño principal de `Perfil` implementado en `src/screens/ProfileScreen.jsx` y `src/App.css`
- `RankingsScreen.jsx` ya no depende de `filteredRankingContexts`
- detalle de filas en `Rankings` migrado de `ModalSheet` a expansión inline compacta
- siguiente bloque natural para ese plan: Fase 7 en navegación y cierre de migración de `Listas`

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

## Pendiente inmediato

La siguiente sesión debería centrarse en verificación o ajustes puntuales:

1. ejecutar `npm run lint`
2. ejecutar `npm run build`
3. si se retoma el plan de Comunidad + Perfil, continuar por Fase 7 (`Comunidad` en navegación y cierre de migración de `Listas`)
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
5. corregir solo si aparece regresión visual o de datos

## Riesgos / decisiones abiertas

- `filteredRankingContexts` sigue existiendo en el provider, pero `RankingsScreen.jsx` ya deriva sus vistas desde `filteredDishEntries` + builders locales
- `Informe` y `Compartir` siguen funcionando, pero su representación impresa todavía se apoya en builders legacy por `typeKey`
- el repo sigue sin `docs/CHECKLIST_TECNICO.md`
- el nuevo buscador de `Mapa` usa búsqueda externa equivalente a Places cuando la red lo permite; falta validarlo en entorno real
- el perfil ya usa follows, achievements, inspiration lists y share links, pero el backend de usuario sigue persistiendo solo `nombre` y `avatar_url` sin `bio`
- Fase 7 sigue pendiente: la navegación y el cierre funcional definitivo de `Listas` aún no están rematados

## Limitación del entorno

No se ha podido ejecutar verificación con:

- `npm run lint`
- `npm run build`
- `node --check server/app.js`

Motivo:

- `npm` y `node` no están disponibles en este entorno (`/bin/bash: command not found`)

Sí se ha podido ejecutar:

- `bash scripts/db/reset.sh`
- validación básica de que las nuevas tablas existen en SQLite

## Archivos que conviene abrir primero al retomar

- `docs/CHECKPOINT.md`
- `docs/CAMBIOS_TAB_RANKINGS.md`
- `src/screens/ProfileScreen.jsx`
- `src/screens/MapScreen.jsx`
- `src/components/map/MapView.jsx`
- `src/screens/RankingsScreen.jsx`
- `src/lib/ranking.js`
- `src/components/rankings/RankingList.jsx`
- `src/components/rankings/RankingCard.jsx`
- `src/App.css`

# Cambios necesarios para refinar la pestaña `Rankings`

## Objetivo
Aplicar el nuevo prompt sobre la pestaña existente `Rankings` sin reconstruir toda la pantalla ni alterar:

- panel de filtros actual
- navegación y comportamiento de otras pantallas
- sistema de color base
- lógica general de contexto (`Mi ranking`, `Mi grupo`, `Comunidad`) fuera de esta pantalla

El objetivo es transformar la implementación actual de `src/screens/RankingsScreen.jsx` hacia un flujo más compacto y más rico en modos de ranking, respetando el resto del producto.

## Estado actual del código
La pestaña está implementada hoy en:

- `src/screens/RankingsScreen.jsx`
- `src/components/rankings/RankingList.jsx`
- `src/components/rankings/RankingCard.jsx`
- `src/components/layout/SectionHeader.jsx`
- `src/lib/ranking.js`
- `src/lib/constants.js`
- `src/App.css`

### Estructura actual de la pantalla
Hoy la pantalla usa esta secuencia visual:

1. hero con título y texto explicativo
2. contador de resultados
3. chips de filtros activos
4. selector de contexto
5. bloque `ranking-swipe-surface` con tipos legacy
6. hint de swipe horizontal
7. `SectionHeader` con botón textual `Filtrar`
8. acciones `Informe` y `Compartir`
9. `RankingList`
10. modal de detalle al tocar una fila

### Observaciones relevantes del estado actual
- `RankingsScreen.jsx` depende de `filteredRankingContexts` desde `AppStateProvider`.
- `RANKING_TYPES` hoy contiene 4 opciones legacy:
  - `Por categoría`
  - `Por tipo de plato`
  - `Global`
  - `Por restaurante`
- `RankingList.jsx` corta siempre a `5` elementos con `entries.slice(0, 5)`.
- `RankingCard.jsx` está optimizada para una única vista genérica:
  - badge grande con emoji
  - nombre de restaurante como label principal
  - línea secundaria genérica con `dishTypeName/categoryName/dishName`
  - `votos`
- `RankingsScreen.jsx` abre detalle en `ModalSheet`, no inline.
- `SectionHeader.jsx` solo soporta acción textual, no icon-only.
- `buildDishTypeRankings()` en `src/lib/ranking.js` usa hoy una fórmula mezclada con promedio global tipo Bayesian:
  - eso contradice el nuevo prompt para modo filtrado
- `buildRestaurantRankings()` usa promedio simple:
  - eso no cumple la nueva fórmula global por restaurante
- `buildGlobalRankings()` solo devuelve ranking de entradas individuales:
  - faltan sub-vistas `Por categoría` y `Por restaurante`
- no existe estado persistente para `recently searched dish types`

## Archivos a tocar

### 1. `src/screens/RankingsScreen.jsx`
Archivo principal del cambio.

Hay que modificar:

- limpieza de hero y textos no permitidos
- selector de contexto compacto
- nuevo selector `Top N`
- sustitución del selector legacy por modos nuevos
- estado local de:
  - modo activo
  - categoría seleccionada
  - tipo de plato seleccionado
  - sub-vista global
  - top N
  - expansión inline
  - búsqueda de tipo de plato
  - recientes de tipo de plato
- render del ranking por modo
- reemplazo del modal de detalle por panel inline expandible

### 2. `src/components/rankings/RankingList.jsx`
Necesita dejar de estar acoplado al corte fijo de 5.

Cambios necesarios:

- eliminar `entries.slice(0, 5)`
- aceptar `entries` ya limitadas desde pantalla o aceptar prop `limit`
- soportar expansión inline por fila o permitir render custom por item

### 3. `src/components/rankings/RankingCard.jsx`
Necesita compactación importante y dejar de ser tan genérica.

Cambios necesarios:

- fila compacta de ~56px
- medalla/top number en formato pequeño
- label principal configurable según modo
- label secundaria compacta
- score badge a la derecha
- contador pequeño y discreto
- soporte para estado expandido

### 4. `src/components/layout/SectionHeader.jsx`
Debe admitir una acción icon-only.

Cambios necesarios:

- variante de acción con icono sin texto visible
- `aria-label` obligatorio
- mantener misma posición a la derecha

### 5. `src/lib/ranking.js`
Es el archivo más sensible a nivel de reglas de ranking.

Hay que modificar o ampliar:

- ranking filtrado por categoría
- ranking filtrado por tipo de plato
- ranking global por plato
- ranking global por categoría
- ranking global por restaurante usando la nueva fórmula
- helpers para detalle inline compacto por restaurante

### 6. `src/lib/constants.js`
Probable ajuste recomendado.

Cambios necesarios:

- revisar `RANKING_TYPES`, porque la UI ya no responde al set legacy actual
- añadir `STORAGE_KEYS.rankingsRecentDishTypes` si se persisten recientes en `localStorage`

### 7. `src/App.css`
Necesita gran parte del remate visual:

- selector de contexto compacto
- botón icon-only de filtro
- chips `Top N`
- nuevos modos y sub-modos
- grid/lista de categorías compacto
- lista de filas compacta
- panel inline expandido compacto
- búsqueda y recientes de tipo de plato

### 8. `src/providers/AppStateProvider.jsx`
Cambio opcional, pero probable.

Recomendación:

- no seguir usando `filteredRankingContexts` como fuente principal de esta pantalla
- mantener `filteredDishEntries`, `categories`, `dishTypes`, `restaurants`, `users`
- mover la composición final de rankings a `RankingsScreen.jsx` + `lib/ranking.js`

Esto evita inflar el provider con combinaciones locales de:

- modo
- sub-vista global
- categoría seleccionada
- tipo de plato seleccionado
- top N

## Cambio funcional solicitado, aterrizado al código actual

## 1. Limpieza visual obligatoria

### Estado actual
`RankingsScreen.jsx` hoy renderiza:

- hero con `Rankings en 2 toques`
- texto explicativo largo
- contador de resultados
- hint `Desliza horizontalmente...`
- botón textual `Filtrar`

### Cambio requerido
Eliminar de la pantalla:

- tagline o intro text
- contador `X resultados encontrados`
- hint de scroll/swipe
- texto visible `Filtrar`

### Implementación recomendada

En `RankingsScreen.jsx`:

- eliminar el bloque `screen__hero`
- eliminar `screen-note` con `rankingItems.length`
- eliminar `<p className="ranking-swipe-hint">`
- mantener la apertura de filtros, pero renderizar el trigger como icon-only

En `SectionHeader.jsx`:

- ampliar props para algo como:
  - `actionIcon`
  - `actionAriaLabel`
  - `actionVariant="icon"`
- si no se quiere tocar globalmente el componente, renderizar un header local solo para `Rankings`

### Nota de accesibilidad
El botón de filtro sin texto visible debe incluir:

- `aria-label="Abrir filtros"`

## 2. Selector de contexto compacto

### Estado actual
Se reutiliza `.pill-button` con tamaño relativamente grande.

### Cambio requerido
Compactar `Mi ranking / Mi grupo / Comunidad`:

- font-size: `12px`
- padding: `4px 10px`
- active state morado
- mantener lógica actual de selección

### Implementación recomendada

En `RankingsScreen.jsx`:

- mantener `activeContext`
- sustituir la fila actual por una clase específica tipo:
  - `rankings-context-row`
  - `rankings-context-chip`

En `App.css`:

- no reutilizar directamente `.pill-button` si eso rompe otras pantallas
- crear variante específica solo para Rankings

## 3. Selector `Top N`

### Estado actual
`RankingList.jsx` corta siempre a `5`.

### Cambio requerido
Añadir selector inline junto al heading `Top`:

- `[5] [10] [25] [50]`
- activo naranja
- default `10`

### Implicación técnica
El límite ya no debe vivir dentro de `RankingList.jsx`.

### Implementación recomendada

En `RankingsScreen.jsx`:

- añadir estado:
  - `topLimit`, default `10`
- renderizar el selector junto al título principal del bloque de ranking

En `RankingList.jsx`:

- eliminar el hardcode `slice(0, 5)`
- recibir ya la lista limitada o una prop `limit`

### Recomendación
Más limpio:

- limitar en `RankingsScreen.jsx`
- dejar `RankingList.jsx` como componente presentacional puro

## 4. Reemplazo del modelo legacy de tipos de ranking

### Estado actual
La pantalla se apoya en:

- `RANKING_TYPES`
- swipe horizontal
- 4 tipos legacy:
  - categoría
  - tipo de plato
  - global
  - restaurante

### Cambio requerido
La nueva UI debe pasar a 3 modos principales:

- `Por categoría`
- `Por tipo de plato`
- `Global`

Y dentro de `Global` debe existir un selector secundario:

- `Por plato`
- `Por categoría`
- `Por restaurante`

### Decisión recomendada
No reutilizar directamente el selector legacy de `RANKING_TYPES` tal y como está.

Conviene sustituirlo por estado local explícito:

- `activeMode = 'category' | 'dishType' | 'global'`
- `activeGlobalView = 'dish' | 'category' | 'restaurant'`

### Implicación técnica
`RANKING_TYPES` en `constants.js` deja de encajar con la pantalla.

Opciones válidas:

1. dejar `RANKING_TYPES` de usar en `RankingsScreen.jsx`
2. redefinir constantes específicas para Rankings:
   - `RANKING_MODES`
   - `GLOBAL_RANKING_VIEWS`

La opción 2 es más clara.

## 5. Modo A — `Por categoría`

### Estado actual
Hoy el ranking por categoría ya existe, pero:

- no pide categoría explícita al usuario
- mezcla todo el contexto en una lista plana
- no tiene selector de tipo de plato subordinado
- el detalle va a modal

### Cambio requerido

#### Paso 1 — selector de categoría
- mostrar todas las categorías
- orden alfabético
- compacto
- icono + nombre
- activo morado

#### Paso 2 — chips de tipo de plato de esa categoría
- listados debajo
- compactos
- activos naranja
- opcionalmente el usuario puede no elegir uno y quedarse en ranking por categoría

#### Paso 3 — ranking de restaurantes
- calcular usando solo entradas del contexto + categoría seleccionada
- si además hay tipo de plato elegido, filtrar aún más
- score = promedio simple de `puntuacion_general` de las entradas filtradas
- `n` = número de entradas filtradas

### Importante
Esto coincide parcialmente con `buildCategoryRankings()`, pero no totalmente.

Porque ahora se necesita:

- ranking por categoría seleccionada
- opcionalmente refinado por tipo de plato dentro de la categoría

### Implementación recomendada
Crear un helper nuevo en `lib/ranking.js` tipo:

- `buildFilteredRestaurantRankings({ entries, restaurants, categories, dishTypes, mode, categoryId, dishTypeId })`

Con comportamiento:

- si hay `categoryId` y no `dishTypeId`:
  - usar solo entradas de esa categoría
- si hay `categoryId` y `dishTypeId`:
  - usar solo entradas de ese tipo de plato
- agrupar por restaurante
- score = promedio simple
- n = número de entradas filtradas

### Inline expansion requerida
Al tocar una fila:

- expandir debajo un panel inline
- no abrir `ModalSheet`
- mostrar platos puntuados de ese restaurante para esa categoría/tipo
- ordenar por score DESC
- una línea por plato:
  - nombre
  - badge score
  - fecha

### Nota importante
La navegación de detalle de otras pantallas no debe tocarse.

El cambio aquí es solo el patrón de detalle local dentro de `Rankings`.

## 6. Modo B — `Por tipo de plato`

### Estado actual
El ranking por tipo de plato actual:

- no arranca desde una búsqueda explícita
- no tiene recientes
- usa una fórmula mezclada con promedio global

### Cambio requerido

#### Paso 1 — recientes + búsqueda
- recientes arriba:
  - últimos 5
  - chips en scroll horizontal
- búsqueda debajo:
  - placeholder `Buscar tipo de plato...`
  - filtrado en tiempo real

#### Paso 2 — ranking de restaurantes para ese tipo de plato
- score = promedio simple de las entradas filtradas de ese `tipo_plato_id`
- n = número de entradas de ese plato en ese restaurante

### Incompatibilidad actual
`buildDishTypeRankings()` hoy usa:

- promedio del restaurante para ese plato
- mezcla con promedio global del plato

Eso contradice el prompt.

### Resolución obligatoria
Modificar o sustituir `buildDishTypeRankings()` para que en modo filtrado use:

- promedio simple de `puntuacion_general`
- `n` del subconjunto filtrado

Sin mezclar:

- otras categorías
- otros platos
- promedio global del plato

### Persistencia de recientes
Como es estado de UI, encaja con la regla del repositorio:

- usar `localStorage`

Implementación recomendada:

- `usePersistentState(STORAGE_KEYS.rankingsRecentDishTypes, [])`
- guardar últimos 5 ids
- deduplicados
- ordenados de más reciente a menos reciente

## 7. Modo C — `Global`

### Estado actual
`Global` hoy solo muestra entradas individuales ordenadas por score.

### Cambio requerido
Dentro del modo `Global` deben existir sub-vistas:

- `Por plato`
- `Por categoría`
- `Por restaurante`

### 7.1. Global — `Por plato`
Es el caso más cercano al actual.

Debe mostrar:

- entradas individuales
- dish name principal
- restaurante secundario
- score

### Observación importante
Hoy `buildGlobalRankings()` usa `entry.nombre_plato`.

Eso puede no estar relleno consistentemente, porque el sistema trabaja sobre `tipo_plato_id`.

### Recomendación
En vez de depender de `nombre_plato`, usar:

- nombre del `dishType`
- y dejar `nombre_plato` solo como fallback

## 7.2. Global — `Por categoría`
Necesita ranking nuevo.

### Implementación recomendada
Crear builder tipo:

- `buildGlobalCategoryRankings({ entries, categories })`

Comportamiento:

- agrupar por `categoria_id`
- score = promedio simple del grupo
- n = número de entradas
- ordenar:
  - score DESC
  - n DESC

### Shape sugerido
Cada item debería exponer:

- `categoryId`
- `categoryName`
- `categoryIcon`
- `score`
- `votos`

## 7.3. Global — `Por restaurante`
Necesita builder nuevo con fórmula específica.

### Estado actual
`buildRestaurantRankings()` usa promedio simple.

### Cambio requerido
Solo para Global > Por restaurante, usar:

```text
restaurant_score = (weighted_avg * log(n + 1)) / log(max_n + 1)

weighted_avg = (sum_scores + global_avg * 5) / (n + 5)
n = número de entradas de ese restaurante
max_n = mayor número de entradas entre restaurantes rankeados
global_avg = media global de score entre todas las entradas consideradas
```

### Implementación recomendada
Crear helper específico:

- `buildGlobalRestaurantRankings({ entries, restaurants })`

Con salida:

- `restaurantId`
- `restaurantName`
- `score`
- `votos`
- opcionalmente `weightedAvg`
- opcionalmente `sumScores`

### Nota importante
Esta fórmula aplica solo a:

- `Global > Por restaurante`

No debe contaminar:

- `Por categoría`
- `Por tipo de plato`

## 8. Reglas de scoring por contexto y modo

## Regla 1 — Modo filtrado
Para:

- `Por categoría`
- `Por tipo de plato`

usar:

```text
filtered_score = average(puntuacion_general de las entradas filtradas)
filtered_n = count(entradas filtradas)
```

Sin mezclar:

- otras categorías
- otros tipos de plato
- promedio global
- fórmula Bayesian/log

## Regla 2 — Modo global restaurante
Solo aquí usar:

- Bayesian average
- factor logarítmico por volumen

## Riesgo actual
La librería `lib/ranking.js` hoy mezcla responsabilidades y fórmulas legacy.

### Resolución recomendada
Separar builders por intención:

- `buildCategoryFilteredRestaurantRankings`
- `buildDishTypeFilteredRestaurantRankings`
- `buildGlobalDishEntryRankings`
- `buildGlobalCategoryRankings`
- `buildGlobalRestaurantRankings`

Si se prefiere menos funciones, al menos separar:

- builders filtrados simples
- builders globales

## 9. Diseño de filas compactas

### Estado actual
`RankingCard.jsx` usa:

- `emoji-badge` grande
- bastante padding
- layout más amplio

### Cambio requerido
Todas las filas deben verse compactas:

- altura aproximada de `56px`
- 5–6 filas visibles sin scroll
- posición y medalla para top 3
- label principal
- score badge
- label secundaria pequeña
- sin decoración extra

### Implementación recomendada
`RankingCard.jsx` debe dejar de inferir todo desde `entry`.

Conviene pasarle datos ya preparados:

- `primaryLabel`
- `secondaryLabel`
- `score`
- `countLabel`
- `position`
- `compactVariant`
- `isExpanded`

O bien sustituir el componente por uno específico para Rankings.

## 10. Expansión inline en vez de modal

### Estado actual
`RankingsScreen.jsx` usa:

- `selectedRankingEntry`
- `buildDetailState()`
- `ModalSheet`

### Cambio requerido
La fila debe expandirse inline, no abrir modal.

### Resolución recomendada

En `RankingsScreen.jsx`:

- sustituir `selectedRankingEntry` por algo como:
  - `expandedEntryId`
- el detalle debe renderizarse justo debajo de la fila activa

### Qué mostrar en el panel expandido

#### Modo A
- entradas del restaurante para categoría/tipo seleccionado

#### Modo B
- entradas del restaurante para el tipo de plato seleccionado

#### Modo C
- depende de la sub-vista:
  - `Por restaurante`: últimas o mejores entradas del restaurante
  - `Por categoría`: lista corta de restaurantes o entradas asociadas si se desea detalle compacto
  - `Por plato`: no necesita gran expansión si la fila ya representa una entrada individual

### Recomendación pragmática
Mantener inline expansion obligatoria al menos en:

- `Por categoría`
- `Por tipo de plato`
- `Global > Por restaurante`

Y dejar `Global > Por plato` como fila simple o expansión mínima.

## 11. Filtro icon-only

### Estado actual
`SectionHeader` usa `actionLabel`.

### Cambio requerido
El trigger debe seguir abriendo `FilterPanel`, pero con icono solo.

### Implementación recomendada

Opción A:

- ampliar `SectionHeader.jsx` con prop `actionContent`

Opción B:

- crear header local en `RankingsScreen.jsx`

Recomendación:

- Opción A si se quiere reutilizable
- Opción B si se quiere cero riesgo en otras pantallas

### No cambiar
No modificar:

- contenido del panel de filtros
- estructura del `FilterPanel`
- lógica de `applyFilters/resetFilters/removeFilter`

## 12. CSS necesario en `src/App.css`

## Limpieza
- eliminar dependencia visual de hero en Rankings
- eliminar estilos asociados al hint de swipe si ya no se usan aquí

## Context selector
- nueva variante compacta de chips
- activo morado

## Top N
- chips pequeños outlined
- activo naranja

## Modos y submodos
- fila de pills moradas compactas
- variante secundaria para `Global`

## Categorías
- grid compacto o scroll horizontal
- orden alfabético
- activo morado

## Tipo de plato
- chips recientes en horizontal
- resultados de búsqueda compactos

## Ranking rows
- altura objetivo `~56px`
- badge más pequeño
- sin divisores
- menos padding

## Inline detail panel
- fondo suave
- padding reducido
- lista de entradas en una línea por fila
- legible sin scroll interno

## Botón filtro
- icon-only
- hit area cómoda
- mismo alineamiento que antes

## 13. Riesgos y dependencias

### Riesgo principal
La pantalla actual depende de `filteredRankingContexts`, pero el nuevo diseño necesita estado local adicional que cambia el subconjunto visible en tiempo real.

### Resolución recomendada
No intentar forzar toda la nueva matriz de combinaciones dentro de `filteredRankingContexts`.

Mejor:

- usar `filteredDishEntries` + `filterEntriesByContext()`
- derivar rankings en `RankingsScreen.jsx` mediante builders especializados de `lib/ranking.js`

### Riesgo secundario
`dishName` en `buildGlobalRankings()` hoy depende de `nombre_plato`, pero el nuevo flujo de alta de platos ya lo está dejando fuera del formulario.

### Resolución obligatoria
Para rankings por plato:

- usar `dishTypes.find(...).nombre` como fuente principal
- `nombre_plato` solo como fallback

### Riesgo de UX
Si se mantiene `ModalSheet` junto a expansión inline, habrá conflicto de patrones.

### Resolución recomendada
En `RankingsScreen.jsx`, eliminar el modal de detalle para esta pantalla.

## 14. Checklist de implementación

- [ ] Eliminar hero/tagline de `Rankings`
- [ ] Eliminar contador de resultados
- [ ] Eliminar hint de swipe/scroll
- [ ] Reemplazar `Filtrar` por botón icon-only
- [ ] Compactar selector `Mi ranking / Mi grupo / Comunidad`
- [ ] Añadir selector `Top N` con default `10`
- [ ] Sustituir selector legacy por 3 modos:
- [ ] `Por categoría`
- [ ] `Por tipo de plato`
- [ ] `Global`
- [ ] Añadir sub-vista dentro de `Global`
- [ ] Ordenar categorías alfabéticamente
- [ ] Añadir selector de tipo de plato subordinado en modo categoría
- [ ] Añadir recientes + búsqueda en modo tipo de plato
- [ ] Persistir últimos 5 tipos de plato buscados
- [ ] Eliminar fórmula Bayesian actual de `buildDishTypeRankings()` para el modo filtrado
- [ ] Implementar fórmula global por restaurante con Bayesian avg × log(n)
- [ ] Añadir ranking global por categoría
- [ ] Ajustar ranking global por plato para no depender solo de `nombre_plato`
- [ ] Rehacer `RankingList` para no cortar fijo a 5
- [ ] Compactar `RankingCard`
- [ ] Sustituir detalle modal por expansión inline
- [ ] Hacer panel expandido compacto, legible y ordenado por score DESC
- [ ] Ajustar CSS para que se vean 5–6 filas con densidad alta

## 15. Criterio de aceptación mapeado al código

Se considerará completado cuando:

- `RankingsScreen.jsx` ya no renderice hero, contador ni hint de swipe
- el trigger de filtros sea icon-only pero siga abriendo `FilterPanel`
- exista selector `Top N` con `10` como valor inicial
- el contexto use chips compactos
- los modos visibles sean exactamente:
  - `Por categoría`
  - `Por tipo de plato`
  - `Global`
- `Global` tenga sub-vistas:
  - `Por plato`
  - `Por categoría`
  - `Por restaurante`
- el ranking por categoría use promedio simple del subconjunto filtrado
- el ranking por tipo de plato use promedio simple del subconjunto filtrado
- el ranking global por restaurante use la fórmula Bayesian × log(n)
- `RankingList.jsx` no tenga `slice(0, 5)` hardcodeado
- `RankingCard.jsx` renderice filas compactas
- tocar una fila expanda un panel inline compacto
- no se haya alterado el contenido del panel de filtros

## 16. Nota de continuidad
El repositorio sigue sin `docs/CHECKPOINT.md`, así que si después se implementa esta especificación convendría registrar allí:

- nuevo modelo de modos/submodos de Rankings
- fórmula global por restaurante
- persistencia de recientes de tipo de plato
- decisión final sobre si `filteredRankingContexts` se mantiene o se desusa en esta pantalla

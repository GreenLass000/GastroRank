# TODO ADAPTADO AL CÓDIGO ACTUAL

## Objetivo de esta revisión
Este documento no cambia las ideas del rediseño de la home. Las reorganiza para que encajen con la arquitectura real actual del proyecto y puedan implementarse sin rehacer la app desde cero.

La pantalla afectada es solo `Inicio`.

No se deben tocar:
- navegación inferior
- FAB
- resto de pantallas
- sistema de color
- flujos de creación y edición ya existentes fuera de la home

## Estado actual del código
La home actual vive en `src/screens/HomeScreen.jsx` y hoy está compuesta así:

1. hero con copy introductoria
2. botón grande de búsqueda dentro del hero
3. bloque visual de estado sincronizado
4. sección `Últimos platos añadidos`
5. sección `Top por categoría`
6. sección `Restaurantes cercanos` en formato lista simple

Además:
- la cabecera global de la app está en `src/App.jsx`
- el banner de sincronización global también se renderiza en `src/App.jsx`
- la geolocalización ya existe en `src/providers/AppStateProvider.jsx`
- el mapa real ya existe en `src/components/map/MapView.jsx`
- la lógica de rankings ya existe en `src/lib/ranking.js`
- el detalle de restaurante ya existe en `src/components/details/EntityDetailSheet.jsx`

## Objetivo funcional real
La home debe pasar de una home de resumen genérico a una home utilitaria con este orden:

1. búsqueda arriba del todo
2. `Últimos platos añadidos`
3. `🏆 Top por plato` con filtro en dos niveles
4. `Restaurantes cercanos` con mapa primero, control de radio y lista debajo

## Regla principal de implementación
No hay que reconstruir la home ni duplicar lógica ya existente.

Hay que:
- reutilizar el modal de búsqueda actual
- reutilizar el estado global ya derivado en `AppStateProvider`
- reutilizar `MapView`
- reutilizar el sheet de detalle ya existente
- extender los rankings derivados solo donde falte la estructura necesaria para esta home

## Bloque 1. Cabecera global y entrada a la home

### Idea que se mantiene
No debe aparecer arriba del todo `PWA gastronómica` ni un título visible de app antes de la búsqueda.

### Cómo encaja en el código actual
Hoy la cabecera visual global está en `src/App.jsx`, no en `HomeScreen`.

### Adaptación correcta
- eliminar de `src/App.jsx` la presentación visual fija de marca para la pantalla principal
- la primera pieza visible útil en home debe ser la búsqueda
- no eliminar la funcionalidad de abrir `GlobalSearchPanel`

### Restricción
La app sigue necesitando un punto de entrada a búsqueda, pero para esta tarea debe resolverse desde la propia home, no desde una cabecera con branding.

## Bloque 2. Hero e intro

### Idea que se mantiene
Desaparece por completo el bloque introductorio:
- tagline
- subtítulo
- texto de onboarding

### Cómo encaja en el código actual
Todo eso está dentro de `src/screens/HomeScreen.jsx` en `screen__hero`.

### Adaptación correcta
- eliminar el hero como bloque de bienvenida
- conservar únicamente la búsqueda como primer bloque útil de la pantalla
- la búsqueda debe seguir abriendo `GlobalSearchPanel` en el modal actual

## Bloque 3. Búsqueda superior

### Idea que se mantiene
La home empieza con una barra de búsqueda visible y usable.

### Cómo encaja en el código actual
Hoy la búsqueda se presenta como botón grande en el hero y dispara `onOpenSearch`.

### Adaptación correcta
- mantener la misma acción `onOpenSearch`
- convertir la búsqueda en el primer componente visible de la home
- el placeholder objetivo es `Buscar restaurante o plato...`
- debe sentirse como barra de búsqueda, no como CTA de hero

### Implicación técnica
No hace falta nueva lógica de búsqueda. Solo cambia el punto de entrada visual.

## Bloque 4. Banner de sincronización

### Idea que se mantiene
No debe mostrarse `Datos sincronizados` cuando todo va bien.

Solo debe aparecer feedback si hay problema real de conectividad o sincronización.

### Cómo encaja en el código actual
Hoy en `src/App.jsx` se renderiza:
- banner de error si `loadError`
- banner de éxito si `dataSource === 'api'`

### Adaptación correcta
- eliminar el banner de éxito por defecto
- mantener feedback explícito solo si hay error real
- el mensaje de error debe quedar orientado a falta de conexión o datos no actualizados
- no debe existir duplicado visual del estado sincronizado dentro de `HomeScreen`

### Restricción
No eliminar el manejo de error real. Solo se elimina el estado positivo permanente.

## Bloque 5. `🏆 Top por plato` con selector en dos niveles

### Idea que se mantiene
La antigua sección `Top por categoría` se sustituye por una sección centrada en plato, con dos filtros:
- nivel 1: categoría
- nivel 2: tipo de plato

Y debajo se muestra el ranking de restaurantes para la selección activa.

### Cómo encaja en el código actual
Hoy la home usa:
- `categories`
- `rankingContexts.private.dishType`
- selección local simple con `activeCategoryId`

La lógica de ranking ya devuelve entradas por combinación `restaurante + tipo de plato`, con:
- `categoryId`
- `dishTypeId`
- `restaurantName`
- `score`
- `votos`

### Adaptación correcta
La implementación debe separar claramente dos cosas:

1. estructura de filtros de UI
- categorías disponibles
- tipos de plato disponibles según categoría seleccionada
- estado de categoría activa
- estado de tipo de plato activo

2. dataset del ranking mostrado
- si hay tipo de plato seleccionado: ranking de restaurantes para ese tipo de plato
- si no hay tipo de plato seleccionado: estado global por defecto coherente con la ausencia de selección

### Decisión de organización para que funcione
El `TODO` no pide rehacer `ranking.js` completo, pero sí preparar una derivación usable desde `AppStateProvider` para la home.

La forma correcta es:
- mantener `buildDishTypeRankings` como base
- derivar en `AppStateProvider` una estructura específica para home, ya ordenada y fácil de consumir
- evitar recalcular filtros complejos dentro de `HomeScreen`

### Estado por defecto
La petición original dice:
- sin selección, mostrar top global de platos

Traducido al código actual eso significa:
- no depender de una categoría obligatoria inicial
- la home debe poder renderizar con `categoría = null` y `tipo = null`
- el contenido por defecto debe salir de todos los tipos de plato disponibles, no solo del primero

### Resultado visual esperado
- título: `🏆 Top por plato`
- fila 1 de chips: categorías
- fila 2 de chips: tipos de plato, filtrados por categoría si aplica
- lista ranking debajo con:
  - posición
  - restaurante
  - score
  - votos

### Restricción importante
No mover esta lógica a `RankingsScreen`. Es una necesidad específica de `HomeScreen`.

## Bloque 6. `Restaurantes cercanos` con mapa primero

### Idea que se mantiene
La sección deja de ser una lista simple y pasa a ser:

1. mapa
2. selector de radio
3. lista filtrada

### Cómo encaja en el código actual
El mapa ya existe en:
- `src/components/map/MapView.jsx`
- `src/screens/MapScreen.jsx`

La geolocalización ya existe en:
- `src/providers/AppStateProvider.jsx`

### Adaptación correcta
La home no debe inventar otro sistema de mapa. Debe reutilizar `MapView` con una configuración específica para esta sección.

### Dependencias reales que hay que resolver
Para que esta sección funcione en la home hacen falta cuatro piezas:

1. punto origen
- usar la ubicación actual si existe
- fallback a Valladolid si no hay permiso o falla la geolocalización

2. cálculo de distancia por restaurante
- hoy no existe un derivado explícito de proximidad en home
- hace falta derivar distancia entre origen actual y cada restaurante con coordenadas válidas

3. filtro por radio
- opciones mínimas: `100 m`, `500 m`, `2 km`, `10 km+`
- el radio filtra tanto los pins como la lista

4. correspondencia radio <-> zoom
- la selección de radio debe mapearse a un zoom de mapa concreto
- no hace falta zoom libre nuevo; hace falta una tabla estable de equivalencias para esta home

### Organización correcta
La parte de proximidad debe resolverse en datos derivados reutilizables, no dispersa en JSX.

La forma más coherente con el proyecto actual es:
- calcular origen y fallback desde `AppStateProvider`
- enriquecer restaurantes con distancia formateada y distancia numérica
- dejar en `HomeScreen` solo el estado UI del radio seleccionado y la selección expandida

## Bloque 7. Mapa embebido en home

### Idea que se mantiene
El mapa aparece antes de la lista y enseña:
- ubicación del usuario
- restaurantes dentro del radio

### Cómo encaja en el código actual
`MapView` ya soporta:
- centrado automático con geolocalización en modo `full`
- fallback a Valladolid
- selección de markers
- clustering

### Adaptación correcta
Para la home hace falta una variante controlada del mapa, no necesariamente una copia del `MapScreen`.

La implementación debe asegurar:
- ancho completo
- zoom controlado por el radio
- markers filtrados por proximidad
- sin romper el comportamiento de la pantalla de mapa principal

### Nota de arquitectura
La petición original dice que el mapa no haga scroll accidental y que el usuario tenga que tocar para interactuar. Esa necesidad debe resolverse como configuración o capa específica de la home, no rompiendo `MapView` globalmente para `MapScreen`.

## Bloque 8. Lista de restaurantes debajo del mapa

### Idea que se mantiene
Debajo del mapa aparece una lista de restaurantes dentro del radio seleccionado.

### Cómo encaja en el código actual
Hoy `HomeScreen` renderiza solo `restaurantsByScore.slice(0, 3)` sin lógica de cercanía.

### Adaptación correcta
La lista de la home debe dejar de estar ordenada por score global y pasar a depender de proximidad filtrada por radio.

Cada tarjeta debe mostrar:
- nombre
- dirección resumida
- badge de score
- distancia

### Regla de dato
La dirección mostrada no debe ser la dirección completa original si esta contiene demasiada información.

Hace falta una utilidad de formato tipo:
- calle + número
- sin ciudad
- sin código postal
- sin país

Esa utilidad debe vivir en `src/lib/format.js` o en una utilidad cercana, no embebida como `split(',')[0]` repetido por JSX.

## Bloque 9. Panel desplegable del restaurante

### Idea que se mantiene
Al tocar una tarjeta se mantiene el comportamiento de desplegable inline.

### Cómo encaja en el código actual
Ese patrón no está en `HomeScreen` actual. El componente reutilizable más cercano hoy es el detalle en `EntityDetailSheet`, pero el `TODO` pide mantener un desplegable inline para esta sección.

### Adaptación correcta
La home necesita un estado local para:
- restaurante expandido
- colapso al tocar la misma tarjeta

Y un bloque expandido específico para cercanía, más breve que el `EntityDetailSheet`.

### Cambios obligatorios dentro del desplegable
- quitar coordenadas crudas
- quitar botón `Cerrar`
- añadir botón `🗺 Cómo llegar`
- mantener el resto de información útil existente

### URL requerida
El botón `Cómo llegar` debe abrir:

`https://www.google.com/maps/dir/?api=1&destination=[lat],[lng]`

### Regla
Este botón es específico del panel inline de la home. No obliga a rehacer todos los detalles de restaurante del proyecto.

## Bloque 10. Qué sí se modifica y qué no

### Sí se modifica
- `src/App.jsx`
- `src/screens/HomeScreen.jsx`
- derivados de estado necesarios en `src/providers/AppStateProvider.jsx`
- utilidades de formato o proximidad necesarias
- configuración puntual de `MapView` si hace falta para la home

### No se modifica
- navegación inferior
- FAB
- `ListsScreen`
- `RankingsScreen`
- `ProfileScreen`
- `ReportScreen`
- flujos CRUD existentes
- stack de mapa base Leaflet + OpenStreetMap

## Orden correcto de implementación
Para que esto funcione sin introducir deuda, el orden debería ser:

1. limpiar cabecera global y banner de sincronización en `App.jsx`
2. rehacer estructura visual de `HomeScreen` sin tocar todavía datos complejos
3. preparar en `AppStateProvider` los derivados que necesita `Top por plato`
4. preparar en `AppStateProvider` o utilidades la lógica de proximidad y formato de distancia/dirección
5. integrar `MapView` en la home con selector de radio
6. construir lista filtrada y panel expandible inline
7. validar que nada de esto rompe `MapScreen`, búsqueda global ni detalle modal existente

## Validación funcional final
Debe cumplirse todo esto:

- no se ve `PWA gastronómica` arriba del todo en la home
- no existe bloque de intro o tagline
- la búsqueda es el primer bloque visible de la home
- no aparece `Datos sincronizados` en estado normal
- el aviso de sync solo aparece si hay error real
- existe `🏆 Top por plato`
- la sección tiene dos niveles de selección: categoría y tipo de plato
- sin selección obligatoria, el estado por defecto es coherente con top global
- `Restaurantes cercanos` muestra mapa antes que lista
- el radio modifica zoom y filtro
- la lista muestra dirección corta y distancia
- el panel expandido no enseña coordenadas
- el panel expandido no tiene botón `Cerrar`
- el panel expandido sí tiene `🗺 Cómo llegar`

## Resumen ejecutivo
Las ideas nuevas no exigen rehacer la aplicación. Exigen reorganizar la home alrededor de capacidades que el proyecto ya tiene:
- búsqueda global existente
- geolocalización existente
- mapa existente
- rankings existentes
- detalle de entidades existente

La clave para que funcione bien es mover la complejidad de datos a derivados estables y dejar `HomeScreen` como capa de composición de UI.

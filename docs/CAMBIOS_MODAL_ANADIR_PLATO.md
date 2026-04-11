# Cambios necesarios para refinar el modal `Añadir plato`

## Objetivo
Aplicar el nuevo prompt sobre el modal existente `Añadir plato` sin reconstruir el flujo completo ni alterar:

- lógica de guardado
- modelo de datos
- cálculo de `puntuacion_general`
- sistema visual base de color
- otras pantallas o modales

El objetivo es adaptar el wizard actual en `src/components/forms/AddDishWizard.jsx` al nuevo orden y comportamiento solicitado.

## Estado actual del código
El wizard actual está implementado en:

- `src/components/forms/AddDishWizard.jsx`
- `src/components/forms/ScoreInput.jsx`
- `src/components/forms/ImageInput.jsx`
- `src/App.css`

### Estructura actual de pasos
Hoy el wizard usa esta secuencia:

1. `Restaurante`
2. `Categoría`
3. `Tipo de plato`
4. `Puntuación`
5. `Detalles`

### Observaciones relevantes del estado actual
- `validateDishEntryPayload` exige `restaurant_id`, `categoria_id`, `tipo_plato_id`, `fecha`, `visibility` y al menos una subpuntuación.
- El wizard hoy separa `categoría` y `tipo de plato` en pasos distintos.
- El campo `nombre_plato` vive hoy en `Detalles` como “Nombre libre del plato”.
- La foto hoy usa `ImageInput` con dos modos:
  - `file`
  - `url`
- La lista de restaurantes muestra:
  - sección de recientes
  - resultados filtrados
  - botón de abrir formulario completo
- Ya existe derivado de restaurantes cercanos en `AppStateProvider`:
  - `homeNearbySection.restaurants`
  - incluye `distanceMeters` y `distanceLabel`
  - está ordenado por proximidad

## Archivos a tocar

### 1. `src/components/forms/AddDishWizard.jsx`
Archivo principal del cambio.

Hay que modificar:

- orden de pasos
- validación por paso
- contenido visible de cada paso
- selección/creación de tipo de plato integrada en el nuevo paso 1
- lógica de restaurantes cercanos con paginación incremental
- eliminación de elementos no permitidos en `Detalles`

### 2. `src/components/forms/ScoreInput.jsx`
Necesita compactación visual del control:

- menos padding vertical
- tipografía más pequeña
- slider más fino
- mantener color naranja

### 3. `src/components/forms/ImageInput.jsx`
Necesita adaptación de UX para foto:

- quitar modo `url`
- permitir cámara con `capture="environment"`
- mantener opción de galería
- mantener vista previa y lectura del archivo

### 4. `src/App.css`
Necesita nuevos estilos o ajuste de clases existentes para:

- progreso del wizard en 4 pasos
- paso 1 compacto
- grid 3 columnas de categorías
- cards de categorías con selección morada
- step de puntuación más compacto
- lista de restaurantes con distancia
- botón de “Crear nuevo restaurante” en una sola línea
- área de “peek” visual del siguiente paso

## Cambio funcional solicitado, aterrizado al código actual

## 1. Nuevo orden de pasos
El array `STEPS` de `AddDishWizard.jsx` debe pasar a:

1. `Nombre y categoría`
2. `Puntuación`
3. `Restaurante`
4. `Detalles`

### Implicación técnica
El paso de `Tipo de plato` desaparece como pantalla independiente, pero no puede desaparecer del flujo lógico porque `tipo_plato_id` sigue siendo obligatorio.

### Resolución compatible con el modelo actual
El nuevo paso 1 debe absorber la lógica de selección/creación de `dishType`:

- categoría
- nombre del tipo de plato
- alias opcional
- selección automática de `tipo_plato_id` existente si ya hay coincidencia por categoría + nombre
- o creación de `dishType` si no existe y el usuario la confirma

No conviene mover esa responsabilidad a `Detalles` porque rompería la validación paso a paso y empeoraría la UX.

## 2. Paso 1: `Nombre del plato + Categoría`

### Estado actual
Hoy este contenido está repartido entre:

- paso `Categoría`
- paso `Tipo de plato`
- campo `Nombre libre del plato` en `Detalles`

### Cambio requerido
Unificar en una sola pantalla:

- campo superior para el nombre del plato/tipo
- campo secundario opcional para alias
- grid completo de categorías
- creación inline de nueva categoría como última celda del grid

### Decisión recomendada sobre el mapeo de datos
Para no romper validación ni persistencia:

- el campo “¿Qué plato vas a puntuar?” debe alimentar el `nombre` del `dishType` a seleccionar o crear
- el campo amistoso secundario debe alimentar `dishType.alias`
- `nombre_plato` debe dejar de editarse manualmente en `Detalles`
- al guardar:
  - si existe un `dishType` con mismo `categoria_id` y mismo `nombre`, usar su `id`
  - si no existe, crear el `dishType` antes de guardar la entrada y usar el `id` devuelto

### Cambios concretos en el componente
- sustituir el bloque actual de paso `Categoría`
- eliminar el paso visual `Tipo de plato`
- reutilizar `dishTypeDraft.nombre` y `dishTypeDraft.alias` como inputs principales del paso 1
- cambiar la etiqueta de alias por una copia amistosa

### Copy recomendado
Usar:

- `¿Qué plato vas a puntuar?`
- `¿Cómo lo llamarías tú? 😄`

Esta segunda opción encaja mejor con el tono del prompt y reutiliza el concepto actual de alias.

### Grid de categorías
Cambios requeridos:

- mostrar todas las categorías sin scroll interno
- 3 columnas fijas en móvil
- icono pequeño
- texto pequeño
- celda final `＋ Nueva categoría`
- cuando se cree una categoría, debe aparecer automáticamente en el grid

### Implementación recomendada
La creación inline actual (`showCategoryCreator`) puede mantenerse, pero debe anclarse al último tile del grid en vez de un botón separado inferior.

## 3. Paso 2: `Puntuación`

### Estado actual
El paso ya existe y usa:

- `ScoreInput`
- `liveScore`
- resumen de `Puntuación general`

### Cambio requerido
Mantener la lógica, compactar la UI y bloquear el avance hasta que el usuario mueva al menos un slider.

### Cambios concretos
En `AddDishWizard.jsx`:

- este paso pasa a índice `1`
- `validateStep` debe impedir avanzar si todas las subpuntuaciones siguen en valor por defecto

En `ScoreInput.jsx`:

- reducir padding del card
- reducir tamaño del label
- hacer el range más fino
- mantener `accent-color: var(--color-orange)`

### Regla de validación
El botón `Siguiente` debe quedar deshabilitado si:

- `sabor === 0`
- `textura === 0`
- `presentacion === 0`
- `calidad_precio === 0`

Esto es más claro que permitir clic y mostrar error posterior.

## 4. Paso 3: `Restaurante`

### Estado actual
Hoy muestra:

- buscador
- restaurantes recientes
- resultados
- botón `Abrir formulario completo`
- creación inline opcional

### Cambio requerido

- eliminar por completo “Restaurantes recientes”
- usar cercanos por distancia
- mantener buscador superior
- limitar la lista a lotes
- mostrar distancia en cada item
- botón `＋ Crear nuevo restaurante` al final y en una sola línea

### Fuente de datos recomendada
Usar `homeNearbySection.restaurants` desde `useAppState()`.

Ese derivado ya resuelve:

- proximidad
- orden por distancia
- `distanceLabel`

### Comportamiento requerido
- por defecto mostrar 5 restaurantes
- `Mostrar más` añade el siguiente lote
- el buscador filtra en tiempo real sobre la lista cercana
- si el filtro reduce resultados, reiniciar el lote visible al primer tramo

### Cambios concretos
En `AddDishWizard.jsx`:

- dejar de usar `recentRestaurants`
- sustituir `filteredRestaurants` actual por un filtrado sobre `homeNearbySection.restaurants`
- añadir estado tipo `visibleRestaurantCount`
- mantener `selectRestaurant`
- mover `onOpenRestaurantForm` al botón inferior único con label:
  - `＋ Crear nuevo restaurante`

### Copy y layout
- el botón no debe envolver texto
- preferible clase de botón outlined o `pill-button` de ancho completo
- debe quedar debajo de la lista y debajo de `Mostrar más`

## 5. Paso 4: `Detalles`

### Estado actual
Hoy contiene:

- `Nombre libre del plato`
- notas
- precio
- fecha
- visibilidad
- `ImageInput` con archivo o URL

### Cambio requerido

- eliminar `Nombre libre del plato`
- eliminar opción `URL externa`
- mantener notas, precio, visibilidad y fecha
- añadir entrada directa a cámara
- mantener opción de elegir desde galería

### Cambios concretos
En `AddDishWizard.jsx`:

- quitar el campo `nombre_plato` del render del paso `Detalles`
- mantener el valor en el payload solo si ya viene de edición o si más adelante se decide precargarlo, pero no exponerlo como campo manual aquí

En `ImageInput.jsx`:

- sustituir el selector de modo `file/url`
- renderizar dos acciones:
  - `📷 Hacer foto`
  - `🖼️ Elegir de la galería`
- ambas deben terminar en lectura de archivo local
- la acción de cámara debe usar:
  - `<input type="file" accept="image/*" capture="environment">`
- la acción de galería debe usar:
  - `<input type="file" accept="image/*">`

### Nota de compatibilidad
El componente actual ya sabe procesar ficheros con `readImageFile`, así que el cambio es de UI y wiring, no de persistencia.

## 6. Validación por paso
La función `validateStep` en `AddDishWizard.jsx` debe reescribirse para los nuevos 4 pasos.

### Reglas recomendadas

#### Paso 1
Debe exigir:

- `categoria_id`
- nombre del plato/tipo no vacío
- `tipo_plato_id` resuelto o capacidad de resolverlo antes de avanzar

#### Paso 2
Debe exigir:

- al menos una subpuntuación distinta de 0

#### Paso 3
Debe exigir:

- `restaurant_id`

#### Paso 4
No necesita bloqueo extra antes de guardar, porque la validación final ya cubre:

- `fecha`
- `visibility`
- al menos una subpuntuación
- `restaurant_id`
- `categoria_id`
- `tipo_plato_id`

## 7. “Peek” del siguiente paso
El prompt pide que cada paso deje ver una pista visual del siguiente.

### Estado actual
El wizard renderiza solo el paso activo, sin preview del siguiente.

### Implementación recomendada
Añadir en `AddDishWizard.jsx` un bloque visual fijo al final del paso activo:

- tarjeta compacta del siguiente paso
- solo título + breve hint
- sin interacción real

Ejemplos:

- tras paso 1: preview “Puntuación”
- tras paso 2: preview “Restaurante”
- tras paso 3: preview “Detalles”

Esto permite cumplir el requisito sin mezclar dos pasos editables a la vez.

### CSS necesario
Crear una tarjeta tipo `wizard-next-peek` con:

- altura baja
- degradado suave
- opacidad media
- pointer-events desactivado

## 8. Cambios de estilo necesarios en `src/App.css`

## Wizard
- pasar `wizard-progress` a 4 columnas en desktop
- mantener versión compacta en móvil
- reducir altura visual de cada chip de paso

## Paso 1
- nueva clase para inputs principales del plato
- etiqueta secundaria del alias con menor peso visual
- `category-grid` en 3 columnas
- `category-card` más compacto
- activo en morado sólido con texto blanco
- celda dashed para `＋ Nueva categoría`

## Paso 2
- compactar `.score-card`
- labels a `12px` o `13px`
- slider más fino
- reducir separación vertical

## Paso 3
- lista más densa
- distancia alineada a la derecha o en segunda línea
- botón full width sin wrap

## Paso 4
- bloque de foto con acciones dobles
- mantener preview

## Peek
- estilos nuevos para preview del siguiente paso

## 9. Riesgos y dependencias a tener en cuenta

### Riesgo principal
El prompt elimina el paso visual de `Tipo de plato`, pero el backend y la validación del frontend no permiten guardar sin `tipo_plato_id`.

### Resolución obligatoria
El nuevo paso 1 debe resolver `tipo_plato_id` de forma explícita:

- búsqueda entre `dishTypes` existentes por `categoria_id + nombre`
- o creación previa del `dishType`

Sin eso, el cambio visual rompería el guardado.

### Riesgo secundario
El documento de continuidad mencionado en `AGENTS.md` no está hoy presente como `docs/CHECKPOINT.md`. Si después de implementar estos cambios se quiere mantener continuidad real, conviene crear o actualizar un documento de checkpoint.

## 10. Checklist de implementación

- [ ] Reordenar `STEPS` a 4 pasos
- [ ] Mover nombre del plato/tipo y alias al nuevo paso 1
- [ ] Integrar selección/creación de `tipo_plato_id` dentro del paso 1
- [ ] Cambiar etiqueta de alias a una copia amistosa en español
- [ ] Convertir categorías a grid compacto de 3 columnas
- [ ] Añadir celda final `＋ Nueva categoría` siempre visible
- [ ] Compactar paso de puntuación
- [ ] Deshabilitar `Siguiente` si ningún slider salió de `0`
- [ ] Eliminar sección `Recientes` de restaurantes
- [ ] Sustituir resultados por cercanos ordenados por distancia
- [ ] Implementar `Mostrar más` por lotes
- [ ] Mantener búsqueda en tiempo real sobre la lista cercana
- [ ] Mover `＋ Crear nuevo restaurante` al final, en una sola línea
- [ ] Eliminar `Nombre libre del plato` del paso `Detalles`
- [ ] Eliminar `URL externa` del flujo de foto
- [ ] Añadir acción `📷 Hacer foto` con `capture="environment"`
- [ ] Mantener acción de galería
- [ ] Añadir preview visual del siguiente paso
- [ ] Ajustar CSS para que cada paso entre sin scroll interno

## 11. Criterio de aceptación mapeado al código

Se considerará completado cuando en el código:

- `AddDishWizard.jsx` renderice solo 4 pasos en el orden nuevo
- el paso 1 resuelva `categoria_id` y `tipo_plato_id`
- `ScoreInput.jsx` permita ver los 4 sliders en una pantalla compacta
- el botón de avance del paso 2 esté deshabilitado si no hay subpuntuaciones
- el paso 3 se alimente de restaurantes cercanos con distancia visible
- ya no exista render de “Recientes”
- `ImageInput.jsx` no ofrezca modo URL
- exista captura de cámara y selector de galería
- ya no se renderice `Nombre libre del plato` en `Detalles`
- `App.css` soporte grid 3 columnas, compactación y preview del siguiente paso

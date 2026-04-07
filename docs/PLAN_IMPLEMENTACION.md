# Plan de Implementación

## Objetivo
Este documento traduce `TODO.md` a un orden de ejecución práctico para completar **Ranking Gastronómico** exactamente como se pide. El orden va de lo más crítico a lo menos crítico. No se debe avanzar a fases visuales o de pulido mientras fallen persistencia, validación, rankings o guardados.

## Reglas base que no se pueden romper
1. Toda la UI visible al usuario debe estar en español.
2. Toda acción asíncrona debe mostrar estado: `Cargando...`, `Guardado ✅` o error explícito.
3. No puede haber fallos silenciosos.
4. La app debe ser usable desde móvil antes que escritorio.
5. Ningún restaurante se puede guardar sin `lat` y `lng`.
6. `puntuacion_general` debe calcularse en tiempo real usando solo subpuntuaciones informadas.
7. La persistencia debe ser completa, sin límites de historial.
8. Deben prevenirse duplicados de restaurantes y de entradas de platos.

## Fase 1: Base técnica y persistencia
Estado actual: `hecha`
1. Definir el modelo de datos exacto de `TODO.md`.
2. Crear una capa SQLite como fuente de verdad para entidades persistentes.
3. Implementar utilidades comunes:
   - UUID
   - fechas
   - normalización de nombres sin acentos
   - cálculo de distancia
   - timeouts para operaciones asíncronas
   - manejo centralizado de errores
4. Crear estructura de base de datos:
   - `server/db/migrations`
   - `server/db/seeds`
   - `server/db/data`
   - scripts de init, seed, reset y verificación
5. Crear un sistema global de feedback:
   - spinner con `Cargando...`
   - toasts de éxito y error
   - confirmaciones para acciones destructivas
6. Añadir seed inicial si la base está vacía:
   - Patricia y Carlos
   - grupo `La Pareja Foodie`
   - restaurantes, categorías, tipos de plato y 10 entradas
7. Exponer una API local mínima de lectura para que el frontend no dependa de acceso directo al archivo SQLite.

Criterio de aceptación:
- La base SQLite se crea desde scripts reproducibles.
- La app abre con datos de prueba solo la primera vez.
- Los datos sobreviven a recarga.
- Los errores de guardado se muestran y no corrompen estado.

## Fase 2: Reglas de negocio críticas
Estado actual: `hecha en lo esencial, pendiente atomicidad de grupos`
1. Implementar creación atómica de grupos:
   - crear grupo
   - añadir creador como `owner`
   - rollback completo si algo falla
2. Implementar detección de duplicados:
   - restaurante por `nombre_normalizado` + proximidad menor a 50 m
   - plato por mismo usuario + restaurante + tipo + fecha
3. Implementar cálculo:
   - `puntuacion_general`
   - puntuación media de restaurante
   - algoritmo de ranking:
     `score = (media_entry * votos + media_global * 5) / (votos + 5)`
4. Implementar visibilidades:
   - `private`
   - `group`
   - `public`

Criterio de aceptación:
- Los cálculos coinciden con `TODO.md`.
- Los duplicados se bloquean o avisan antes de guardar.

## Fase 3: Capa de acceso frontend
Estado actual: `hecha`
1. Sustituir el bootstrap en memoria por carga desde la API local.
2. Mostrar `Cargando...` mientras se hidrata el estado.
3. Si la API falla, mostrar error visible y fallback controlado.
4. Mantener el mismo modelo de datos entre frontend, API y SQLite.

Criterio de aceptación:
- Inicio, Rankings, Listas, Perfil y Mapa leen datos desde la API SQLite.
- No hay fallos silenciosos si la API no responde.

## Fase 4: Navegación principal móvil
Estado actual: `hecha`
1. Crear layout base mobile-first.
2. Añadir barra inferior fija:
   - Inicio
   - Rankings
   - Mapa
   - Listas
   - Perfil
3. Garantizar objetivos táctiles de al menos 44 px.
4. Añadir transiciones suaves entre pantallas.
5. Añadir FAB `➕ Añadir plato rápido`.

Criterio de aceptación:
- Desde móvil no hay scroll horizontal.
- Cualquier ranking se alcanza en máximo 2 toques.

## Fase 5: Flujo “Añadir restaurante”
Estado actual: `parcial`
1. Crear formulario con validación previa al guardado.
2. Implementar 3 formas de asignar ubicación:
   - búsqueda asistida de lugares/autocomplete
   - pulsación larga en mapa de al menos 500 ms
   - botón de ubicación actual
3. Al seleccionar ubicación:
   - autocompletar dirección y coordenadas
   - mostrar mini mapa de confirmación
4. Preparar `cover_photo_url` con subida de archivo o URL externa.

Criterio de aceptación:
- Si faltan coordenadas, aparece:
  `La ubicación es obligatoria. Búscala con IA, selecciona en el mapa o usa tu ubicación actual.`

## Fase 6: Wizard de 5 pasos para añadir plato
Estado actual: `parcial avanzado`
1. Paso 1: elegir restaurante o crear uno rápido.
2. Paso 2: elegir categoría o crearla.
3. Paso 3: elegir tipo de plato o crearlo.
4. Paso 4: puntuar con sliders y entrada manual exacta.
5. Paso 5: detalles opcionales, foto, precio, visibilidad y fecha.
6. Guardar con actualización optimista y opción de reintento si falla.

Criterio de aceptación:
- Nunca se pierden datos introducidos si falla el guardado.
- El preview de puntuación cambia en vivo y con colores correctos.

## Fase 7: Rankings
Estado actual: `hecha`
1. Implementar contextos:
   - Mi ranking
   - Mi grupo
   - Comunidad
2. Implementar tipos:
   - por categoría
   - por tipo de plato
   - global
   - por restaurante
3. Mostrar top 3 con tratamiento oro, plata y bronce.
4. Permitir swipe entre tipos de ranking.
5. Añadir vista detalle por entrada de ranking.

Criterio de aceptación:
- “Mejor Croqueta de jamón” devuelve resultados correctos y ordenados.

## Fase 8: Filtros
Estado actual: `hecha`
1. Implementar todos los filtros de `TODO.md`.
2. Hacer dependiente `Tipo de plato` de `Categoría`.
3. Añadir chips eliminables de filtros activos.
4. Guardar filtros en `localStorage`.
5. Mostrar contador de resultados.

Criterio de aceptación:
- `Aplicar filtros` y `Resetear` funcionan en todos los contextos.

## Fase 9: Mapa interactivo
Estado actual: `hecha`
1. Integrar mapa real con Leaflet + OpenStreetMap.
2. Mostrar restaurantes como pins.
3. Implementar pulsación larga para crear restaurante.
4. Implementar tarjeta de detalle al tocar pin existente.
5. Centrar en ubicación del usuario y usar Valladolid si no hay permiso.
6. Añadir estilos de pin:
   - punto por score
   - icono de categoría
   - foto
   - precio
   - score numérico
7. Añadir preferencia global y override por restaurante.
8. Añadir clustering.

Criterio de aceptación:
- Nunca se confunde un tap normal con una pulsación larga.

## Fase 10: Inicio, listas y perfil
Estado actual: `parcial avanzado`
1. Inicio:
   - buscador principal
   - últimos platos
   - top por categoría
   - restaurantes cercanos
2. Listas:
   - vistas filtrables y reutilizables de restaurantes y platos
3. Perfil:
   - avatar por archivo o URL
   - estadísticas
   - grupos e invitaciones
   - ajustes de tema, idioma y pin por defecto

## Fase 11: Exportación, impresión y compartir
Estado actual: `pendiente`
1. Exportar CSV con cabeceras en español.
2. Crear ruta `/informe` con CSS de impresión.
3. Implementar `window.print()`.
4. Generar enlaces públicos con token para rankings públicos.
5. Copiar enlace al portapapeles con confirmación visible.

## Fase 12: PWA, rendimiento y robustez final
Estado actual: `pendiente`
1. Añadir manifest, iconos y soporte instalable.
2. Optimizar imágenes:
   - validar formatos
   - máximo 5 MB
   - comprimir en cliente si supera 1 MB
3. Revisar accesibilidad y rendimiento móvil.
4. Verificar todos los checklists de `TODO.md`.
5. Ejecutar siempre:
   - `npm run lint`
   - `npm run build`
   - `npm run db:verify`

## Orden de cierre
1. Primero hacer que guardar, recuperar y rankear funcione.
2. Después cerrar mapa, wizard y filtros.
3. Después terminar home, perfil, listas y compartir.
4. El pulido visual va al final, nunca antes de la lógica crítica.

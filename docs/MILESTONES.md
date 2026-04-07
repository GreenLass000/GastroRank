# Milestones de Implementación

## Objetivo
Este documento convierte el alcance definido en `TODO.md` en una secuencia de milestones y commits recomendados. El orden está pensado para mantener la app siempre en un estado usable, verificable y sin adelantar pulido visual antes de cerrar la lógica crítica.

## Milestone 1
### `chore: scaffold app architecture and shared constants`
Estado: `hecho`
- definir estructura base de carpetas
- crear shell principal de la app
- preparar navegación inferior, layout móvil y tokens de color
- crear módulos compartidos para utilidades, hooks y componentes

## Milestone 2
### `feat: add sqlite schema scripts and initial seed data`
Estado: `hecho`
- implementar estructura `server/db`
- crear esquema SQLite
- añadir scripts de init, seed, reset y verify
- cargar seed inicial si la base está vacía
- añadir Patricia, Carlos, grupo inicial, restaurantes, categorías y platos de prueba
- verificar persistencia tras recarga

## Milestone 3
### `feat: implement core domain rules and scoring engine`
Estado: `hecho`
- crear validaciones de negocio
- normalizar nombres
- detectar duplicados de restaurantes y platos
- implementar creación atómica de grupos
- calcular `puntuacion_general` y score de restaurante

## Milestone 4
### `feat: build mobile shell home profile and lists screens`
Estado: `hecho`
- cerrar estructura móvil principal
- implementar home, listas y perfil
- añadir feedback global de carga, éxito y error
- validar objetivos táctiles y ausencia de scroll horizontal

## Milestone 5
### `feat: implement add restaurant flow with location requirements`
Estado: `parcial`
- crear formulario de restaurante
- exigir `lat` y `lng`
- añadir ubicación actual, mini mapa y validaciones
- dejar preparada integración con búsqueda real de lugares/autocomplete
- permitir fijar pin con long-press y precarga desde el mapa principal

## Milestone 6
### `feat: implement 5-step add dish wizard with optimistic save`
Estado: `parcial`
- construir wizard completo de 5 pasos
- añadir sliders y entrada manual para puntuaciones
- soportar foto por archivo o URL
- implementar guardado optimista y reintento seguro

## Milestone 7
### `feat: add rankings engine and ranking detail views`
Estado: `hecho`
- implementar contextos de ranking
- añadir ranking por categoría, tipo, global y restaurante
- aplicar fórmula oficial de score
- crear vista de detalle por entrada

## Milestone 8
### `feat: add filters persistence and result chips`
Estado: `hecho`
- implementar todos los filtros obligatorios
- persistir filtros entre sesiones
- mostrar chips activos y contador de resultados
- asegurar dependencia entre categoría y tipo de plato

## Milestone 9
### `feat: add interactive map with long-press and custom pins`
Estado: `hecho`
- integrar mapa interactivo con Leaflet + OpenStreetMap
- detectar long-press de 500 ms para crear restaurante
- mostrar detalle al tocar un pin
- soportar pins por score, categoría, foto, precio y valor numérico
- centrar en ubicación del usuario con fallback a Valladolid
- añadir clustering y selección visual activa

## Milestone 10
### `feat: add csv export printable report and public share links`
Estado: `pendiente`
- exportar CSV con cabeceras en español
- crear ruta `/informe`
- implementar impresión con `window.print()`
- generar enlaces públicos de solo lectura
- copiar enlace al portapapeles con confirmación

## Milestone 11
### `chore: finalize pwa polish accessibility and production hardening`
Estado: `pendiente`
- añadir manifest e instalación PWA
- optimizar imágenes y validar formatos
- revisar accesibilidad y rendimiento móvil
- comprobar checklist final de `TODO.md`
- verificar scripts y consistencia de SQLite
- ejecutar `npm run lint` y `npm run build`

## Regla de cierre
1. Primero se cierran persistencia, guardados y cálculos.
2. Después formularios, wizard, rankings y filtros.
3. Después mapa, compartir, exportación e informe.
4. El pulido final solo empieza cuando la lógica crítica ya está estable.

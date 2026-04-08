# Milestones de Implementación

## Estado resumido

### Milestones 1 a 10
Estado: `hecho`
- arquitectura base
- SQLite y seeds
- scoring y rankings
- mapas Leaflet + OSM
- filtros persistentes
- CSV, informe y share público

### Milestone 11
`chore: finalize pwa polish accessibility and production hardening`
Estado: `hecho en código, pendiente verificación final`
- manifest, iconos y service worker añadidos
- compresión cliente de imágenes añadida
- cierre básico de accesibilidad en modales y objetivos táctiles
- pendiente ejecutar `db:verify`, `lint` y `build` con Node disponible

### Milestone 12
`feat: close interaction audit edit flows and detail views`
Estado: `hecho en código, pendiente validación manual final`
- edición completa desde UI para perfil, grupos, restaurantes, categorías, tipos y dish entries
- detalle útil reutilizable en home, listas, mapa, perfil e informe
- búsqueda global desde topbar y hero
- CTAs muertos eliminados o conectados

## Milestone final real pendiente
`chore: run final verification on a machine with node`

### Alcance
- `npm run db:verify`
- `npm run lint`
- `npm run build`
- prueba manual final de creación, edición, share, CSV, informe e instalación PWA
- pequeñas correcciones si aparecen defectos reales

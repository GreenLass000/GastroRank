# Plan de Implementación

## Estado actual del plan
El plan de implementación grande está ejecutado. No queda ningún bloque amplio pendiente salvo la validación final en un entorno con Node.

## Lo ya cerrado
1. Persistencia SQLite y API local.
2. Reglas de negocio, duplicados y scoring.
3. Navegación móvil y pantallas principales.
4. Alta y edición de restaurantes.
5. Alta y edición de dish entries.
6. Alta y edición de grupos.
7. Edición de perfil, categorías y tipos de plato.
8. Rankings, filtros, listas, mapa, CSV, share e informe.
9. Detalle al tocar elementos principales.
10. PWA mínima instalable con manifest y service worker.

## Plan restante
1. Ejecutar `npm run db:verify`.
2. Ejecutar `npm run lint`.
3. Ejecutar `npm run build`.
4. Probar manualmente:
   - creación y edición
   - detalle al tocar tarjetas
   - exportación CSV
   - informe y share
   - instalación PWA
5. Corregir solo lo que falle en esa pasada.

## Restricción de esta sesión
No se pudieron correr los pasos 1 a 3 porque este shell no tiene `node` ni `npm`.

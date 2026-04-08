# Checklist Técnico

## Cierre funcional
- [x] `src/lib/validation.js` centraliza validaciones de usuario, grupo, restaurante, categoría, tipo y dish entry
- [x] `server/app.js` expone creación y edición real sobre SQLite
- [x] `src/lib/api.js` soporta `PUT` para todas las entidades editables
- [x] `src/providers/AppStateProvider.jsx` rehidrata estado local sin recarga tras edición
- [x] `src/components/forms/RestaurantForm.jsx` crea y edita restaurantes
- [x] `src/components/forms/AddDishWizard.jsx` crea y edita dish entries
- [x] `src/components/forms/GroupForm.jsx` crea y edita grupos
- [x] `src/components/forms/ProfileForm.jsx` edita perfil y avatar
- [x] `src/components/forms/CategoryForm.jsx` edita categorías
- [x] `src/components/forms/DishTypeForm.jsx` edita tipos de plato

## Interacción y detalle
- [x] topbar search con funcionalidad real
- [x] hero search de home con funcionalidad real
- [x] `SectionHeader` no muestra acciones sin handler
- [x] restaurantes en home abren detalle
- [x] entradas recientes en home abren detalle
- [x] restaurantes en listas abren detalle
- [x] entradas en listas abren detalle
- [x] grupos en listas y perfil abren detalle
- [x] restaurantes del mapa abren detalle
- [x] items del informe tienen interacción útil
- [x] existe un sheet reutilizable de detalle y edición

## PWA e imágenes
- [x] `public/manifest.webmanifest`
- [x] iconos en `public/`
- [x] `public/sw.js`
- [x] registro de service worker en `src/main.jsx`
- [x] metadatos PWA en `index.html`
- [x] compresión cliente > 1 MB
- [x] validación de formato y tamaño de imagen compartida

## Verificación pendiente
- [ ] `npm run db:verify`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] validación manual final en entorno con `node` y `npm`

## Nota
La única razón por la que la sección de verificación sigue abierta es que esta sesión no dispone de `node` ni `npm` en `PATH`.

# Siguiente Paso del Proyecto

## Bloque inmediato
El siguiente bloque funcional recomendado es cerrar el resto del flujo de imágenes y del alta de restaurante.

Este bloque existe porque ya están cerrados:
- rankings
- filtros persistentes
- mapa interactivo con clustering y preferencia de pin
- búsqueda real de lugares sobre proveedor abierto

Lo que sigue pendiente en el núcleo de producto es:
- foto de portada por archivo o URL en restaurante
- componente reutilizable `ImageInput` para archivo o URL
- reutilizarlo en alta de plato
- validación mínima de formato y tamaño antes de guardar

## Objetivo del bloque
Dejar tanto el alta de restaurante como el wizard de platos con una entrada de imagen coherente, reutilizable y suficientemente robusta para uso real.

## Archivos a tocar primero
1. `src/components/forms/ImageInput.jsx`
2. `src/components/forms/RestaurantForm.jsx`
3. `src/components/forms/AddDishWizard.jsx`
4. `src/lib/images.js`
5. `src/App.css`

## Alcance exacto

### 1. `src/components/forms/ImageInput.jsx`
Crear un componente reutilizable que soporte:
- modo `archivo`
- modo `url`
- toggle claro entre ambos modos
- preview simple
- mensajes de error visibles

Debe aceptar al menos:
- `value`
- `mode`
- `label`
- `onChange`
- `onModeChange`
- `error`

### 2. `src/components/forms/RestaurantForm.jsx`
Sustituir el campo actual de foto por:
- toggle `📷 Subir foto` / `🔗 URL externa`
- integración con `ImageInput`
- guardado en `cover_photo_url`

### 3. `src/components/forms/AddDishWizard.jsx`
Reutilizar `ImageInput` en el paso de detalles para `foto_url`.

No duplicar lógica visual entre restaurante y plato.

### 4. `src/lib/images.js`
Añadir utilidades mínimas para:
- validar tamaño máximo
- validar formatos permitidos
- convertir archivo a `data URL` si hace falta preview local

Alcance mínimo aceptable:
- jpg
- jpeg
- png
- webp
- heic si el navegador lo entrega como tipo válido
- máximo 5 MB

### 5. `src/App.css`
Añadir estilos del input de imagen sin romper el layout móvil ni generar scroll horizontal.

## Criterios de aceptación
- restaurante permite foto por archivo o URL
- wizard de plato permite foto por archivo o URL usando el mismo componente
- si el archivo supera tamaño o formato permitido aparece error visible
- no hay fallos silenciosos
- el valor no se pierde al cambiar entre modos salvo que sea necesario limpiarlo explícitamente

## Orden recomendado
1. crear `ImageInput`
2. crear `src/lib/images.js`
3. conectar restaurante
4. conectar wizard de platos
5. ajustar estilos
6. actualizar `docs/CHECKPOINT.md`
7. actualizar `docs/CHECKLIST_TECNICO.md`
8. actualizar `docs/MILESTONES.md` si cambia estado de milestones
9. ejecutar `npm run lint`
10. ejecutar `npm run build`

## Qué no tocar en este bloque
- exportación CSV
- informe imprimible
- share público
- manifest PWA
- refactor amplio del estado global

## Nota
Si durante este bloque aparece deuda menor de UI, solo corregirla si bloquea el flujo de imagen. El objetivo aquí es funcionalidad base, no pulido final.

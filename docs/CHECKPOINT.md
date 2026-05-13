# CHECKPOINT

## Fecha
- 2026-05-13

## Estado actual
El repo ya no está en espera.

Estado real de continuidad:

- existe un nuevo bloque activo de frontend
- el documento rector del bloque es `docs/PLAN_FRONTEND_MAESTRO.md`
- el checklist ejecutable del bloque es `docs/CHECKLIST_TECNICO.md`
- el alcance aprobado mezcla:
  - modularización del estado y shell
  - fixes UX visibles de `TODO.md`
  - deuda técnica prioritaria del audit
  - hardening de sesión por fases

Base ya existente que se debe preservar mientras avanza el bloque:

- autenticación operativa con registro, login por `usuario o correo`, `auth/me`, cambio de contraseña y logout
- backend PostgreSQL + Drizzle funcionando
- feed social, follows, recomendaciones, listas, comentarios, reacciones y logros ya implementados
- uploads reales de imágenes implementados
- paginación real del feed implementada
- `Inicio`, `Rankings`, `Mapa`, `Comunidad` y `Perfil` ya funcionales, aunque con deuda estructural y UX pendiente

Cambios recientes ya aplicados:

- rediseño fuerte de `AuthScreen` con onboarding/carrusel y formularios separados
- la pantalla de login ya no hereda el layout con scroll de la app autenticada
- el login ahora respeta el tema activo real de la app
- hotfix importante de privacidad/social:
  - `/api/bootstrap` ya no es pública
  - el bootstrap ya no entrega todas las valoraciones ni todos los datos sociales sin filtrar
  - se bloquearon lecturas genéricas sensibles en backend
  - se añadió búsqueda segura de usuarios en `/api/users/search`
  - `GlobalSearchPanel` ya busca usuarios reales y permite seguir/dejar de seguir

## Estado de continuidad
Sí hay una fase activa.

Bloque activo:
- plan maestro frontend
- prioridad alta en modularización, mapas, rankings, comunidad, búsqueda global y sesión

Siguiente fase aprobada:
- `Fase 0. Continuidad documental`
- tras cerrarla, continuar con `Fase 1. Estabilidad inmediata`

Regla actual:
- no volver a describir el repo como “cerrado” hasta que este bloque termine de verdad
- no reabrir auditorías nuevas mientras el plan maestro siga vigente salvo petición explícita

## Cómo retomar
Si se retoma el trabajo en una sesión futura:

1. leer este archivo
2. leer `docs/PLAN_FRONTEND_MAESTRO.md`
3. leer `docs/CHECKLIST_TECNICO.md`
4. leer `TODO.md`
5. ejecutar solo la siguiente fase abierta del checklist

## Próximo paso por defecto
El siguiente paso natural es:
- cerrar `Fase 0. Continuidad documental` si queda algo pendiente
- empezar `Fase 1. Estabilidad inmediata`

Antes de volver al refactor planificado conviene validar manualmente:

- que un usuario no ve listas ni valoraciones privadas ajenas
- que `Buscar amigos` devuelve usuarios y permite seguir/dejar de seguir
- que `Comunidad`, `Perfil`, seguidores, seguidos y recomendaciones siguen funcionando tras el recorte de bootstrap

## Archivos de referencia
- `AGENTS.md`
- `TODO.md`
- `docs/PLAN_FRONTEND_MAESTRO.md`
- `docs/CHECKLIST_TECNICO.md`
- `docs/audits/whole-frontend-analize-code.md`
- `docs/CAMBIOS_TAB_RANKINGS.md`
- `docs/CAMBIOS_MODAL_ANADIR_PLATO.md`
- `server/app.js`
- `src/providers/AppStateProvider.jsx`
- `src/App.jsx`
- `src/screens/AuthScreen.jsx`
- `src/components/search/GlobalSearchPanel.jsx`

## Nota
Los anexos viejos siguen valiendo como detalle de ejecución, pero la prioridad y el orden oficial están ahora en:
- `docs/PLAN_FRONTEND_MAESTRO.md`
- `docs/CHECKLIST_TECNICO.md`

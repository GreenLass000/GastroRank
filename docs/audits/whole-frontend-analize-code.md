# Frontend completo — Audit Report

## Date
- 2026-05-10

## Scope reviewed
- Route/page/module: frontend completo de la PWA React
- Files reviewed:
  - `src/App.jsx`
  - `src/providers/AppStateProvider.jsx`
  - `src/screens/HomeScreen.jsx`
  - `src/screens/RankingsScreen.jsx`
  - `src/screens/MapScreen.jsx`
  - `src/screens/ComunidadScreen.jsx`
  - `src/screens/ProfileScreen.jsx`
  - `src/components/layout/ModalSheet.jsx`
  - `src/components/search/GlobalSearchPanel.jsx`
  - `src/components/forms/RestaurantForm.jsx`
  - `src/components/forms/ProfileForm.jsx`
  - `src/lib/api.js`
  - `src/lib/storage.js`
- Runtime assumptions:
  - La app es cliente-only con Vite + React.
  - PostgreSQL/backend real no estuvo auditado en profundidad; se revisó solo para entender contratos y límites.

## Stack classification
- React
- No aplica Web Components

## Inputs and methodology
- Skills used:
  - `analize-code`
  - `web-design-guidelines`
  - `frontend-design`
  - `vercel-react-best-practices`
  - `vercel-composition-patterns`
- Code areas inspected:
  - shell de navegación, auth y share
  - provider global y estado derivado
  - Home, Rankings, Mapa, Comunidad y Perfil
  - modales, búsqueda global y formularios clave
- Runtime/build verification performed:
  - `npm run lint` ✅
  - `npm run build` ✅
  - observación: bundle principal `dist/assets/index-FqTwLdIH.js` = `563.17 kB`
- Limitations:
  - no se hizo prueba manual visual en navegador móvil
  - la seguridad backend no se validó end-to-end
  - conclusiones de auth/autorización están limitadas al contrato visible desde frontend

## Executive summary
El frontend está funcional y compila sin errores, pero arrastra tres problemas de mayor impacto: una capa de estado global demasiado concentrada, una home que no coincide con la dirección de producto documentada y una estrategia de sesión basada en `localStorage` que amplifica cualquier XSS futuro. A eso se suma deuda de UX en modales y deep-linking de estado, y un bundle ya por encima del umbral de advertencia de Vite.

La prioridad no es “rehacer” la app, sino desacoplar el shell y los dominios principales, corregir la home según `TODO.md` y endurecer la sesión. La base de componentes y los estados de carga/error existen; el problema es más de estructura, coherencia de flujo y límites de responsabilidad que de ausencia total de UX.

## Findings by severity

### Critical
- No se confirmaron hallazgos críticos en el frontend revisado.

### High
- Title: La home implementada no respeta el flujo de producto documentado
  - why it matters: `TODO.md` define `Inicio` como acceso utilitario con búsqueda arriba, sin hero introductorio ni cabecera de marca fija. El código actual duplica jerarquía visual y desplaza la acción principal.
  - evidence:
    - `src/App.jsx:292` renderiza una topbar persistente con copy editorial y acceso global a búsqueda.
    - `src/screens/HomeScreen.jsx:122` vuelve a renderizar un hero editorial completo antes de la barra de búsqueda.
    - `src/screens/HomeScreen.jsx:149` coloca la búsqueda después del hero, no como primer bloque útil.
  - affected files:
    - `src/App.jsx`
    - `src/screens/HomeScreen.jsx`
    - `TODO.md`
  - recommended fix:
    - mover el punto de entrada principal de búsqueda al primer bloque visible de `HomeScreen`
    - simplificar la topbar de `home` para que no compita con la búsqueda
    - eliminar el hero introductorio o convertirlo en información secundaria colapsable

- Title: `AppStateProvider` concentra demasiadas responsabilidades y ya condiciona rendimiento y mantenibilidad
  - why it matters: un provider de `1702` líneas que mezcla auth, bootstrap, filtros, geolocalización, toasts, social, rankings y CRUD vuelve costoso cualquier cambio y provoca rerenders amplios por cambios de dominios no relacionados.
  - evidence:
    - `src/providers/AppStateProvider.jsx:660` inicia estado global, persistencia, geolocalización y estado social en un solo provider.
    - `src/providers/AppStateProvider.jsx:690` construye `derivedState` monolítico desde todo el `state`.
    - `src/providers/AppStateProvider.jsx:1597` expone una `value` muy grande con datos y acciones de múltiples dominios.
    - tamaños actuales: `AppStateProvider.jsx` `1702` líneas, `ProfileScreen.jsx` `1707`, `MapScreen.jsx` `883`, `RankingsScreen.jsx` `783`.
  - affected files:
    - `src/providers/AppStateProvider.jsx`
    - `src/screens/ProfileScreen.jsx`
    - `src/screens/MapScreen.jsx`
    - `src/screens/RankingsScreen.jsx`
  - recommended fix:
    - separar providers o hooks por dominio: `auth`, `bootstrap`, `social`, `rankings`, `map/home`
    - mover selectores pesados a hooks especializados
    - reducir la superficie del context y exponer interfaces más estables

- Title: La sesión cliente depende de `localStorage`, aumentando el impacto de cualquier XSS
  - why it matters: aunque no vi una inyección directa confirmada en el frontend revisado, guardar el bearer token en `localStorage` deja la sesión accesible a cualquier script que logre ejecutarse en la página.
  - evidence:
    - `src/lib/api.js:48` lee el token desde `window.localStorage` para adjuntarlo a todas las peticiones autenticadas.
    - `src/providers/AppStateProvider.jsx:635` y `src/providers/AppStateProvider.jsx:639` leen/escriben el token persistente.
    - `src/lib/storage.js:19` consolida el patrón de persistencia cliente.
  - affected files:
    - `src/lib/api.js`
    - `src/providers/AppStateProvider.jsx`
    - `src/lib/storage.js`
  - recommended fix:
    - migrar a cookie `HttpOnly` y `SameSite`
    - dejar en `localStorage` solo preferencias no sensibles
    - si la migración no es inmediata, reducir superficies que renderizan contenido externo y revisar CSP

### Medium
- Title: Los modales no implementan gestión de foco robusta y fuerzan `autoFocus` en el botón de cierre
  - why it matters: hoy el diálogo es cerrable y tiene `aria-modal`, pero no hay focus trap, no se restaura foco al disparador y el `autoFocus` en el cierre es una mala experiencia móvil y de teclado.
  - evidence:
    - `src/components/layout/ModalSheet.jsx:18` solo escucha `Escape`.
    - `src/components/layout/ModalSheet.jsx:39` aplica `autoFocus` al botón de cerrar.
    - no hay lógica de focus trap ni restauración del foco anterior.
  - affected files:
    - `src/components/layout/ModalSheet.jsx`
    - `src/components/search/GlobalSearchPanel.jsx`
  - recommended fix:
    - encapsular foco con un trap simple
    - devolver foco al trigger al cerrar
    - reservar el foco inicial para el input primario cuando tenga sentido y evitar `autoFocus` indiscriminado en móvil

- Title: El estado principal de Rankings y Comunidad no está deep-linkado en URL
  - why it matters: la app sincroniza pantalla y `share`, pero el resto del estado significativo se pierde al recargar, no se puede enlazar y hace más difícil soporte, QA y uso colaborativo.
  - evidence:
    - `src/App.jsx:42` y `src/App.jsx:55` solo manejan `screen` legado y `share`.
    - `src/screens/RankingsScreen.jsx:147`-`163` guarda contexto, modo, filtros locales y selección en `useState`.
    - `src/screens/ComunidadScreen.jsx:104`-`119` guarda tab, página y filtros solo en estado local.
  - affected files:
    - `src/App.jsx`
    - `src/screens/RankingsScreen.jsx`
    - `src/screens/ComunidadScreen.jsx`
  - recommended fix:
    - mover al query string el estado de alto valor: tab, página, contexto, modo, filtros y búsqueda
    - mantener en memoria solo estados efímeros como sheets abiertos

- Title: La búsqueda global hace demasiados recorridos lineales por pulsación
  - why it matters: con dataset pequeño funciona, pero la estructura actual recalcula y hace `find` anidados en cada tecleo. Ya hay una advertencia de bundle grande; esta pantalla refuerza el patrón de trabajo costoso en cliente.
  - evidence:
    - `src/components/search/GlobalSearchPanel.jsx:18`-`42` filtra varias colecciones completas por búsqueda.
    - `src/components/search/GlobalSearchPanel.jsx:26`, `33`, `35`, `123`, `144`, `147` usan `find` repetidos dentro de listas.
  - affected files:
    - `src/components/search/GlobalSearchPanel.jsx`
  - recommended fix:
    - precalcular lookups (`Map`) y un índice ligero por nombre
    - diferir render de resultados pesados o limitar trabajo por keystroke

- Title: La capa de share pública está duplicada en pantallas distintas
  - why it matters: el mismo flujo de creación de token, copia y mensajes aparece en más de un sitio. Eso dispersa reglas y eleva el riesgo de divergencia funcional.
  - evidence:
    - `src/screens/RankingsScreen.jsx:387`-`415` implementa share y copia.
    - `src/screens/ProfileScreen.jsx:722`-`767` vuelve a implementar el mismo patrón.
  - affected files:
    - `src/screens/RankingsScreen.jsx`
    - `src/screens/ProfileScreen.jsx`
  - recommended fix:
    - extraer un hook o servicio `usePublicShare` con API común para token, copia y estados de feedback

### Low
- Title: La copia y algunos placeholders no siguen un criterio tipográfico consistente
  - why it matters: no rompe flujos, pero resta pulido y coherencia visual.
  - evidence:
    - `src/screens/HomeScreen.jsx:156` usa `...` en vez de `…`
    - `src/components/search/GlobalSearchPanel.jsx:64` usa `...`
    - `src/screens/RankingsScreen.jsx:647` usa `...`
  - affected files:
    - `src/screens/HomeScreen.jsx`
    - `src/components/search/GlobalSearchPanel.jsx`
    - `src/screens/RankingsScreen.jsx`
  - recommended fix:
    - normalizar copy de placeholders, cargas y vacíos con un helper editorial o checklist de copy

- Title: Hay mezcla de componentes de alto nivel con trabajo de agregación local repetitivo
  - why it matters: no es un bug inmediato, pero complica lectura y reduce reutilización.
  - evidence:
    - `src/screens/ComunidadScreen.jsx:37`-`78` normaliza recomendaciones dentro de la pantalla.
    - `src/screens/RankingsScreen.jsx:57`-`126` y `418`-`500` resuelven detalle inline complejo dentro del screen.
    - `src/screens/ProfileScreen.jsx` concentra estadísticas, share preview, listas y grupos en un solo archivo.
  - affected files:
    - `src/screens/ComunidadScreen.jsx`
    - `src/screens/RankingsScreen.jsx`
    - `src/screens/ProfileScreen.jsx`
  - recommended fix:
    - extraer selectores y submódulos de pantalla por bloque funcional

## UI / UX / Accessibility review
- visual hierarchy:
  - buena base de tarjetas, chips y estados visuales
  - la jerarquía de `Inicio` está sobrecargada por topbar + hero + búsqueda, lo que va contra el objetivo utilitario del producto
- spacing and density:
  - consistente en general
  - `Perfil` y `Rankings` concentran demasiados bloques interactivos en una sola vista y se sienten pesados para móvil
- responsiveness:
  - no vi patrones obviamente desktop-only en JSX
  - falta validación manual de scroll, sheet y mapa en viewport móvil real
- touch targets:
  - en general correctos por uso de botones grandes y chips
  - algunos listados de chips en `Rankings` y `Perfil` pueden generar fatiga por densidad
- contrast and readability:
  - la app mantiene bastante contraste y copy clara
  - hay mucho texto descriptivo editorial en cabeceras que no siempre aporta acción
- keyboard/focus behavior:
  - correcto uso básico de `button`
  - modales sin focus trap ni restauración de foco
  - `autoFocus` en `ModalSheet` y `GlobalSearchPanel` debe revisarse
- loading, empty and error states:
  - es una fortaleza del repo: casi todos los flujos visibles tienen feedback explícito
  - sigue habiendo repetición manual de banners/estados que podría unificarse
- copy clarity:
  - buena calidad general en español
  - hay mezcla entre lenguaje editorial y utilitario; `Inicio` es el caso más claro

## Stack-specific best-practices review

### React
- rendering:
  - hay uso de `useMemo` en puntos correctos, pero el provider global invalida demasiadas ramas a la vez
  - la búsqueda global y varias pantallas siguen haciendo trabajo de agregación en render
- state ownership:
  - demasiado estado de dominio vive en un solo context
  - `ProfileScreen` y `RankingsScreen` retienen mucha lógica derivada que debería vivir en hooks/selectores
- effects and async flows:
  - los efectos principales tienen cancelación básica correcta
  - hay duplicación de fetch/refetch manual, por ejemplo en `ComunidadScreen` tras reaccionar
- data fetching:
  - contratos de API claros y centralizados en `src/lib/api.js`
  - la sesión y el share están bien encapsulados a nivel de llamadas, pero no a nivel de política
- bundle or hydration risks:
  - no hay riesgo SSR/hydration porque la app es cliente-only
  - sí hay riesgo de bundle por concentración funcional; `vite build` ya marca el chunk principal por encima de 500 kB

## Architecture / Maintainability review
- component or element API design:
  - los componentes base son razonables
  - el problema aparece en screens y provider demasiado grandes
- separation of concerns:
  - insuficiente entre estado, selectores, side effects y presentación
- reusability:
  - existen piezas reutilizables, pero muchas reglas de negocio siguen acopladas a pantallas concretas
- screen vs shared component boundaries:
  - `RankingsScreen`, `ProfileScreen` y `ComunidadScreen` hacen demasiado trabajo de preparación de datos
- provider/store/custom-element responsibilities:
  - `AppStateProvider` ya funciona como store total de la app y como capa de dominio
- maintainability risks:
  - cambios en rankings/social/mapas pueden seguir creciendo en el provider
  - la duplicación de share y de selectores locales aumentará drift funcional

## Security review
- auth and session handling:
  - riesgo probable por token en `localStorage`
  - no se observó exposición directa del password en UI
- authorization boundaries:
  - el frontend envía `created_by_user_id` y otros ids en varios payloads, pero no se puede concluir vulnerabilidad sin validar enforcement backend
  - la revisión del servidor sugiere autenticación real, pero no fue una auditoría completa de autorización
- private data exposure:
  - el flujo de share pública es explícito y parece intencional
  - el riesgo mayor visible en frontend es la sesión persistida
- unsafe user-controlled content:
  - no vi `dangerouslySetInnerHTML`
  - `MapView` escapa HTML en pins manuales antes de renderizar markup de Leaflet
- upload, URL or redirect risks:
  - uploads pasan por API propia
  - las URLs externas se abren con `noreferrer`, bien
- API trust boundaries:
  - el frontend no debe seguir enviando ids de autor/creador como si fueran fuente de verdad
  - sin revisar enforcement backend no puedo marcarlo como hallazgo confirmado
- missing validation or sanitization:
  - formularios clave sí pasan por validaciones cliente antes de guardar

## Cross-cutting improvements
- Partir `AppStateProvider` por dominios reduciría bundle, rerenders y complejidad de pruebas.
- Crear hooks/selectores compartidos para `share`, `rankings detail`, `recommendations` y `search indexing` eliminaría duplicación y haría más predecible el estado.
- Sincronizar estado relevante con URL resolvería a la vez DX, QA, soporte y experiencia de recarga.
- Ajustar el shell de `Inicio` y la política de modales elevaría UX sin tocar reglas de negocio.

## Prioritized action plan
1. Immediate fixes
   - alinear `Inicio` con `TODO.md`: búsqueda primero, sin hero duplicado
   - definir plan de migración de sesión fuera de `localStorage`
   - encapsular `ModalSheet` con focus trap y foco inicial correcto
2. Short-term cleanup
   - extraer `usePublicShare`
   - deep-link de `Rankings` y `Comunidad`
   - optimizar búsqueda global con lookups precomputados
3. Structural improvements
   - separar `AppStateProvider` por dominios y mover selectores pesados a hooks
   - trocear `ProfileScreen` y `RankingsScreen` en submódulos
4. Optional polish
   - unificar criterio editorial de placeholders y textos de carga
   - revisar densidad visual de `Perfil` y `Rankings` para móvil

## Open questions / assumptions
- Asumo que `TODO.md` sigue siendo la referencia funcional vigente para `Inicio`; si ya no lo es, el hallazgo de la home baja de severidad.
- No validé comportamiento de foco, scroll y hojas modales con lector de pantalla ni con navegador móvil real.
- No confirmé si backend ignora siempre ids sensibles enviados por el cliente; el frontend actual sugiere que debería hacerlo, pero esa garantía no pertenece a este informe.

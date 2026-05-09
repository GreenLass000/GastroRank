# Rediseño Neo-Bistró con Modo Claro/Oscuro

## Resumen
- Reorientar la app hacia una estética mobile-first premium inspirada en `design.png`: fotografía dominante, tarjetas densas, navegación más limpia, superficies con blur y jerarquía tipo app social gastronómica.
- Mantener el producto actual y su lógica de datos; el rediseño será de frontend e IA ligera, no de backend.
- Añadir selector de tema para que el usuario pueda elegir `claro`, `oscuro` o `sistema`, conservando los colores actuales como acentos de marca.

## Cambios de implementación
- Extraer de `src/App.css` un sistema de tokens por tema para superficies, texto, bordes, sombras y acentos; aplicarlo con `data-theme` en la raíz.
- Sustituir `Inter` por una pareja más editorial y usable; por defecto, `Fraunces` para titulares y `Manrope` para cuerpo y UI.
- Dividir los estilos en capas (`tokens`, `shell`, `componentes`, `pantallas`) para dejar de depender de un único `App.css` de más de 3k líneas.
- Rediseñar `App.jsx` como shell contextual con topbar más útil, búsqueda visible, transiciones suaves y FAB mejor integrada visualmente con la navegación inferior.
- Reordenar la navegación a `Inicio / Explorar / Mapa / Rankings / Perfil`; `Comunidad` pasará a mostrarse como `Explorar`, manteniendo su funcionalidad social actual.
- Mantener `Mapa` como tab dedicada; no se elimina del nivel principal porque es una capacidad central del producto.
- Convertir `AuthScreen` en una entrada tipo splash editorial con marca, beneficio claro y tabs de login/registro, sin añadir onboarding persistente separado en v1.
- Rediseñar `HomeScreen` siguiendo la lógica del mockup: saludo, búsqueda arriba, bloque top semanal, categorías explorables, preview de mapa cercano y actividad reciente.
- Reordenar `ComunidadScreen` como feed de descubrimiento más visual, con chips superiores, tarjetas ricas y subtabs `Explorar` y `Amigos`.
- Modernizar `MapScreen` solo en chrome, controles, cards y bottom sheet; se conserva Leaflet + OpenStreetMap y el comportamiento actual.
- Convertir `RankingsScreen` en una leaderboard más compacta y legible, con tabs de contexto claras, tarjetas densas y detalle inline más limpio.
- Reforzar `ProfileScreen` con cabecera más potente, mejores bloques de stats y logros, actividad reciente y ajuste de tema.
- Rehacer `EntityDetailSheet` y `AddDishWizard` como hojas más inmersivas, con hero visual, progreso claro, CTA fijo y jerarquía mejor definida.
- Aplicar el nuevo sistema visual a `ReportScreen`, manteniendo la variante de impresión limpia y clara.

## APIs, interfaces y tipos
- Añadir `src/providers/ThemeProvider.jsx` y un `useTheme()` con `themeMode`, `resolvedTheme` y `setThemeMode`.
- Extender `STORAGE_KEYS` con una clave de tema persistente.
- Envolver la app desde `main.jsx` con `ThemeProvider` y propagar `data-theme` a `html` o `body`.
- Ampliar `BottomNav` para soportar el nuevo orden visual y un estado activo más prominente sin cambiar los ids funcionales actuales.
- Ampliar `ModalSheet` con variantes `default` e `immersive`, altura completa opcional y header configurable.
- No cambiar endpoints, schema PostgreSQL/Drizzle ni modelo SQLite en esta fase.

## Plan de pruebas
- Verificar cambio entre `claro`, `oscuro` y `sistema`, persistencia tras recarga y ausencia de flash visual inicial.
- Revisar contraste, foco y legibilidad en `Auth`, `Inicio`, `Explorar`, `Mapa`, `Rankings`, `Perfil` y `Report`.
- Confirmar que la navegación reordenada sigue dejando rankings accesible en dos toques como máximo.
- Validar login, registro, búsqueda, detalle, añadir plato, edición, compartir ranking y filtros sociales tras el rediseño.
- Validar geolocalización, fallback a Valladolid, long-press en mapa, selección de pin y jerarquía de overlays en ambos temas.
- Cerrar la fase con `npm run lint`, `npm run build` y revisión manual mobile-first en 360px, 390px y ancho desktop estrecho.

## Suposiciones y defaults
- El mockup se usará como referencia de tono, composición y densidad, no como copia literal.
- Los colores actuales se mantienen como identidad de marca; el modo oscuro solo añade una escala nueva de neutros.
- No se crea un sistema real de notificaciones ni una pantalla de onboarding persistente en esta fase.
- El mapa mantiene el stack actual Leaflet + OpenStreetMap y sus reglas de comportamiento existentes.

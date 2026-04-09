# ADAPTED

SCREEN: Home (Inicio)
ACTION: Modify existing home screen — do NOT rebuild from scratch, only apply the changes listed below.

========================================================
CHANGES TO APPLY
========================================================

--- 1. REMOVE: Top header bar ---
Remove the "PWA Gastronómica" (or any app title label) shown at the very top of the home screen.
The screen should start directly with the search bar.

--- 2. REMOVE: Hero/intro section ---
Remove the introductory block that contains:
- "Descubre, puntúa y comparte" (or any variant of that tagline)
- Any subtitle or description copy below it
- Any onboarding/welcome text

--- 3. KEEP: Search bar ---
Keep the search bar at the top of the screen (first visible element after status bar).
It should remain full-width, with placeholder "Buscar restaurante o plato...".

--- 4. REMOVE: Sync status banner (default state) ---
Remove the "Datos sincronizados" status indicator that is shown by default.
Sync status should ONLY appear when there is an actual sync error or connectivity problem,
shown as a dismissible inline warning banner in red/orange:
"Sin conexión — los datos pueden no estar actualizados ⚠️"
In all other cases (connected, synced) → show nothing.

--- 5. REPLACE: "Top por categorías" section → "Top por plato" with two-level selector ---

Replace the current top categories section with a new "🏆 Top por plato" section.

Layout:
- Section title: "🏆 Top por plato"
- Below the title: two horizontally scrollable pill/chip rows:
  - Row 1 — CATEGORÍA: chips for each category (e.g. Croquetas, Tortilla, Sardinas, Postres...)
    Selecting a category filters Row 2.
  - Row 2 — TIPO DE PLATO: chips for dish types belonging to the selected category
    (e.g. if "Croquetas" selected → show "Croqueta de jamón", "Croqueta de boletus")
    If no category selected → show all dish types.
- Below the two chip rows: a ranked list of top restaurants for the selected dish type,
  showing: position number, restaurant name, score badge, number of votes.
- Default state (no selection): show global top dishes across all categories.
- Chips style: outlined when inactive, filled ORANGE when active.

--- 6. REPLACE: "Restaurantes cercanos" section — map-first layout ---

Replace the current list-only "Restaurantes cercanos" section with a map-first layout:

6a. MAP (shown first):
- Full-width embedded map showing the user's current location as a centered pin
- Default zoom corresponds to the selected radius
- Map is non-interactive scroll-wise (user must tap to interact),
  but shows restaurant pins within the selected radius

6b. RADIUS SELECTOR (below map or overlaid at bottom of map):
- Horizontal segmented control with options:
  [ 100m ] [ 500m ] [ 2km ] [ 10km+ ]
- Selecting a radius:
  - Updates the map zoom level to match (100m = very zoomed in, 10km+ = zoomed out)
  - Filters the restaurant list below the map

6c. RESTAURANT LIST (below map):
- Show restaurants within selected radius as cards
- Each card shows:
  - Restaurant name (bold)
  - SHORT address: show only street name + number (NOT full address with city/postal code)
    Example: "Calle Cava Baja, 15" NOT "Calle de la Cava Baja 15, 28005 Madrid, España"
  - Score badge (colored by score: green ≥8, orange 5–7.9, red <5)
  - Distance label (e.g. "320 m")
- Tapping a card expands an inline dropdown panel (already exists — keep this behavior)

6d. CHANGES TO EXPANDED DROPDOWN PANEL:
In the expanded restaurant detail panel, apply these changes:
- REMOVE: raw coordinates display (lat/lng values)
- REMOVE: "Cerrar" / close button (user closes by tapping the card again)
- ADD: "🗺 Cómo llegar" button → opens Google Maps directions URL in new tab:
  https://www.google.com/maps/dir/?api=1&destination=[lat],[lng]
- Keep all other existing info in the panel as-is

========================================================
THINGS TO NOT CHANGE
========================================================
- Bottom navigation bar (tabs): leave exactly as-is
- "Últimos platos añadidos" section: leave as-is
- Floating action button (➕): leave as-is
- Color system (orange/purple/green): leave as-is
- All other screens: do NOT touch

========================================================
VALIDATION
========================================================
✅ No app title shown at top of home screen
✅ No intro/tagline copy visible
✅ Sync banner only appears on error
✅ Top por plato section has two chip rows (category → dish type)
✅ Map appears before restaurant list in "Restaurantes cercanos"
✅ Radius selector changes map zoom and filters list
✅ Restaurant cards show short address only
✅ Expanded panel has "Cómo llegar" button, no coordinates, no close button

# ORIGINAL

pantalla de inicio:

quitar lo de datos sincronizados y la intro de descubre, puntúa y comprará, .

dejar arriba una barra de búsqueda. 

quitar la segunda parte de datos sincronizados y solo hablar de los datos sincronizados si falla . 

el orden será: top por plato y se podrá elegir el plato o la categoría en dos niveles diferentes. 

restaurantes cercanos se verán no no solo en lista sino que primero se verá un mapa poniendo tu ubicación y se podrá elegir el ratio de 100 m a. 2km o a más de 10 km y de ahí se hará más grande o más pequeño el mapa y el zoom. een la descripción del restaurante no parecerá toda la dirección al completo sino que será resumida y sidaa se abrirá un desplgablebcomonahora y alguno de los botones será como llegar, se quita de este desplegable las coordenadas como tal del mapa y el botón de cerrar. 


arriba del todo se quitará el PWA gastronómica
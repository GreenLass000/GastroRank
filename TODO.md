Create a mobile-first application called "Ranking Gastronómico" (Gastronomic Ranking).

The goal is to register restaurants, score specific dishes, and generate personal, group, and global (community) rankings.
The app must be fast, stable, and fully usable from mobile devices.

========================================================
ROLE & CONTEXT
========================================================

You are an expert full-stack developer building a production-ready gastronomic ranking PWA.
The app targets Spanish-speaking users who want to track, score, and compare food experiences
across restaurants — individually, with their partner/friends group, and against the community.
Prioritize correctness, stability, and UX above all else. Every action must have feedback.
Every save must succeed or show a clear error. No silent failures allowed.

========================================================
1) GLOBAL RULES (MANDATORY — NEVER SKIP)
========================================================

- All UI text must be in SPANISH
- Color system:
  - ORANGE (#FF6B35) → primary buttons, CTAs, highlights
  - PURPLE (#7B2D8B) → bottom nav tabs, secondary nav, headers
  - GREEN (#2ECC71) → success states, positive scores, confirmations
  - RED (#E74C3C) → errors, destructive actions
  - WHITE/LIGHT GRAY (#F8F9FA) → backgrounds

- UX rules:
  - Maximum 2 taps to reach any ranking
  - Every action must show clear feedback:
    - Success: "Guardado ✅"
    - Error: "Error al guardar ❌ — [reason]"
    - Loading: spinner with text "Cargando..."
  - Mobile-first: touch targets ≥ 44px, no horizontal scroll
  - Smooth transitions between screens (slide/fade)

- Full data persistence with no history limits
- All forms must validate before submitting
- Prevent duplicate entries with smart detection

========================================================
2) DATA MODEL (CRITICAL — BUILD THIS EXACTLY)
========================================================

--- 2.1 Users ---
- id (UUID)
- nombre (string)
- avatar_url (string, supports blob/file upload OR external URL)
- created_at (timestamp)

--- 2.2 Groups ---
- id (UUID)
- nombre (string)
- tipo (enum: pareja | amigos | familia | otros)
- visibility (enum: privado | público)
- join_policy (enum: código | aprobación | abierto)
- invite_code (auto-generated unique 6-char alphanumeric)
- created_by_user_id (FK → Users)
- created_at (timestamp) ← REQUIRED FIELD, auto-set on creation

RULES:
- On group creation: automatically add creator as "owner" member in a single atomic transaction
- This flow must NEVER fail — wrap in try/catch with rollback
- created_at must always be stored and displayed in group detail views

--- 2.3 Group Members ---
- id (UUID)
- group_id (FK → Groups)
- user_id (FK → Users)
- role (enum: owner | admin | member)
- status (enum: active | pending)
- joined_at (timestamp)

--- 2.4 Restaurants ---
- id (UUID)
- nombre (string, required)
- nombre_normalizado (string, lowercase, no accents — for dedup detection)
- direccion_texto (string)
- google_maps_url (string)
- lat (decimal, required) ← LOCATION IS MANDATORY
- lng (decimal, required) ← LOCATION IS MANDATORY
- precio_rango (enum: € | €€ | €€€)
- tags (array of strings)
- notas (text)
- created_at (timestamp)
- created_by_user_id (FK → Users)
- cover_photo_url (string, supports blob/file upload OR external URL)

RULES — RESTAURANT CREATION:
- MUST NOT allow saving a restaurant without lat/lng coordinates
- Show validation error: "La ubicación es obligatoria. Búscala con IA, selecciona en el mapa o usa tu ubicación actual."
- Provide three ways to assign location:
  1. AI + Google Places API search (type name, AI finds it)
  2. Long-press on map to drop pin (NOT a single tap — must be a deliberate long-press ≥ 500ms)
  3. "Use my current location" button (GPS)
- After coordinates are set, show a mini map preview confirming pin placement

--- 2.5 Categories ---
- id (UUID)
- nombre (string)
- icono (emoji or icon name)
- scope (enum: global | grupo | usuario)
- created_by_user_id (FK → Users, nullable for global)

--- 2.6 Dish Types (DishTypes) ---
- id (UUID)
- categoria_id (FK → Categories)
- nombre (string) — e.g. "Croqueta de jamón"
- alias (string, optional)
- scope (enum: global | grupo | usuario)
- created_by_user_id (FK → Users, nullable for global)

--- 2.7 Dish Entries (DishEntries) — CORE TABLE ---
- id (UUID)
- restaurant_id (FK → Restaurants)
- categoria_id (FK → Categories)
- tipo_plato_id (FK → DishTypes)
- nombre_plato (string, optional free-text description)
- sabor (decimal 0.0–10.0, 1 decimal place)
- textura (decimal 0.0–10.0, 1 decimal place)
- presentacion (decimal 0.0–10.0, 1 decimal place)
- calidad_precio (decimal 0.0–10.0, 1 decimal place)
- puntuacion_general (decimal, AUTO-CALCULATED — see rules below)
- precio_plato (decimal, optional)
- notas (text, optional)
- fecha (date, defaults to today)
- foto_url (string, supports BOTH:
    - Blob/file upload: user picks image from gallery/camera → stored as base64 or blob
    - External URL: user pastes a URL string
    Show toggle: "📷 Subir foto" | "🔗 URL externa")
- created_by_user_id (FK → Users)
- group_id (FK → Groups, nullable)
- visibility (enum: private | group | public)
- created_at (timestamp)

RULES — AUTO-CALCULATED puntuacion_general:
- puntuacion_general = average of all non-null sub-scores entered
- Formula: (sabor + textura + presentacion + calidad_precio) / count_of_filled_scores
- If only sabor is filled → puntuacion_general = sabor
- If sabor + textura filled → puntuacion_general = (sabor + textura) / 2
- etc. — always average only the scores the user actually entered
- Show live preview of puntuacion_general as user fills in sub-scores
- Display puntuacion_general prominently with color coding:
  - ≥ 8.0 → GREEN
  - 5.0–7.9 → ORANGE
  - < 5.0 → RED
- Restaurant's overall score = weighted average of ALL its dish puntuacion_general values

========================================================
3) AI + MAPS INTEGRATION (CRITICAL FEATURE)
========================================================

3.1 Google Places / Maps API Integration

Integrate Google Maps JavaScript API + Places API for:

A) AI-ASSISTED RESTAURANT SEARCH
- On the "Add Restaurant" form, include a smart search bar at the top:
  "🔍 Buscar lugar con IA (Google Maps)"
- As user types the restaurant name (min 3 chars), call Places Autocomplete API
- Show dropdown with suggestions: name + address + distance
- On selection:
  - Auto-fill: nombre, direccion_texto, lat, lng, google_maps_url
  - Show mini confirmation map with the pin
  - Display: "Ubicación encontrada ✅ — [address]"

B) INTERACTIVE MAP (full screen)
- Use Google Maps with custom styled theme (dark/light toggle)
- Show all restaurants as pins on the map
- Long-press on map (≥ 500ms hold) → shows confirmation dialog:
  "📍 ¿Crear nuevo restaurante aquí?" with [Crear] and [Cancelar] buttons
  (Do NOT trigger on single tap — must require deliberate long-press)
- Single tap on existing pin → shows restaurant info card (name, score, best dish)

C) CUSTOM MAP PINS (VISUAL VARIETY)
Pins must support multiple visual styles — user can choose per restaurant:

Pin style options:
1. Default dot pin (colored by average score: green/orange/red)
2. Category icon pin (emoji in a rounded square bubble) — e.g. 🍕 for pizza
3. Photo pin: restaurant's cover_photo_url shown in a circular cropped pin frame
4. Price pin: €/€€/€€€ label pin with color coding
5. Score pin: shows the numeric score (e.g. "8.5") in a colored badge pin

Pin customization:
- User can set preferred pin style globally (Settings) or per-restaurant
- Pins scale slightly on hover/tap for visual feedback
- Selected/active pin is larger and has a white border highlight
- Cluster pins when zoomed out (show count bubble)

========================================================
4) RANKING SYSTEM (CORE OF THE APP)
========================================================

4.1 Ranking Contexts
- "Mi ranking" (private — my entries only)
- "Mi grupo" (group entries combined)
- "Comunidad" (all public entries)

4.2 Ranking Algorithm (MANDATORY — implement exactly):
score = (media_entry * votos + media_global * 5) / (votos + 5)

Where:
- media_entry = average puntuacion_general for this dish type at this restaurant
- votos = number of entries for this dish type at this restaurant
- media_global = global average puntuacion_general across all entries for this dish type

Sort order: 1st by score DESC, 2nd by votos DESC, 3rd by media DESC

4.3 Ranking Types
- By category (e.g. "Best Croquettes")
- By dish type (e.g. "Best Croqueta de jamón") ← KEY FEATURE
- Global (all dishes combined)
- By restaurant (best overall)

4.4 Ranking UI
- Top 3 get gold/silver/bronze medal treatment
- Each entry shows: restaurant name, score, vote count, best photo
- Tap entry → detail view with all dish entries for that type at that restaurant
- Swipe between ranking types

========================================================
5) ADD DISH FLOW (5-STEP WIZARD — MUST ALWAYS WORK)
========================================================

Step 1 — Restaurant
- Search existing (fuzzy match on nombre_normalizado)
- Or quick-create new (requires location — see rules)
- Show recent restaurants for quick access

Step 2 — Category
- Show category grid with icons
- "+" to create new category on the fly

Step 3 — Dish Type
- Show dish types for selected category
- "+" to create new dish type on the fly
- Search within dish types

Step 4 — Scoring
- Horizontal swipe card per sub-score: sabor / textura / presentacion / calidad_precio
- Slider (0.0–10.0) + tap number to type exact value
- Live puntuacion_general preview updates as each sub-score is entered (see calculation rules)
- Color-coded score preview badge

Step 5 — Details (all optional)
- Notes textarea
- Photo: choose blob upload (gallery/camera) OR paste URL
- Price field
- Visibility selector (private / group / public)
- Date picker (default: today)

On save:
- Show loading spinner "Guardando..."
- On success: "Guardado ✅" toast + update UI immediately (optimistic update)
- On error: "Error ❌ [reason]" — never lose user data, offer retry

========================================================
6) FILTERS (MUST ALL WORK PERFECTLY)
========================================================

Available filters:
- Categoría (multi-select)
- Tipo de plato (multi-select, dependent on category)
- Año (year picker)
- Solo con foto (toggle)
- Rango de precio (€ / €€ / €€€)
- Autor/usuario (for group context)
- Zona (radius from current location, in km)
- Puntuación mínima (slider)

UX:
- "Aplicar filtros" button → applies all selected filters
- "Resetear" button → clears all filters
- Active filters shown as dismissible chips below the search bar
- Result count: "X resultados encontrados"
- Filters persist between sessions (saved in localStorage)

========================================================
7) EXPORT & SHARE
========================================================

7.1 CSV Export
- Export all data (restaurants + dishes + scores) as .csv
- Include headers in Spanish
- Filename: "ranking_gastronomico_[date].csv"

7.2 Printable Report Screen (NOT native PDF)
Route: /informe

Layout:
- Header with app logo + title + context (Mi ranking / Grupo / Comunidad)
- Date range of data
- Top 10 / Top 20 ranking cards (visual, with photos if available)
- Sub-score breakdown bars per entry
- "🖨 Imprimir / Guardar como PDF" button → triggers window.print()
- Print-optimized CSS (@media print): hide nav, show full content

7.3 Share
- "Compartir ranking" → generates a public URL token
- Public URL shows read-only ranking view
- Respects visibility settings (only shows public entries)
- Copy-to-clipboard with "¡Enlace copiado! 📋" confirmation

========================================================
8) NAVIGATION & HOME
========================================================

Bottom navigation bar (always visible, PURPLE):
- 🏠 Inicio
- 🏆 Rankings
- 🗺 Mapa
- 📋 Listas
- 👤 Perfil

Home screen:
- Hero search bar (searches restaurants + dish types)
- "➕ Añadir plato rápido" floating action button (ORANGE, bottom-right)
- "Últimos platos añadidos" horizontal scroll cards
- "Top por categoría" section with category chips + mini rankings
- "Restaurantes cercanos" section (if location granted)

Profile screen:
- Avatar (supports blob upload OR external URL)
- Stats: total platos, total restaurantes, grupos
- My groups list with invite codes
- Settings: default pin style, theme, language

========================================================
9) CRITICAL BUG-PREVENTION RULES
========================================================

- ALL database writes must be wrapped in error handling with user-facing feedback
- NO action should be possible without a loading state
- NO state should be left inconsistent on error
- Validate ALL required fields client-side before any API call
- Prevent duplicate restaurants: check nombre_normalizado + lat/lng proximity (< 50m)
- Prevent duplicate dish entries: warn if same user + same restaurant + same dish type + same date
- All async operations must have timeout handling
- Images must be validated: max 5MB, accepted formats: jpg/png/webp/heic
- Blob uploads must be compressed client-side before storage if > 1MB

========================================================
10) SEED DATA (TEST DATA)
========================================================

Create on first load if database is empty:

Users:
- Patricia (avatar: 👩) + Carlos (avatar: 👨)

Group:
- "La Pareja Foodie" (tipo: pareja, visibility: privado, owner: Patricia, created_at: auto)

Restaurants (all with real coordinates):
1. Bar El Fideo — Madrid, Calle de la Cava Baja 15 (lat: 40.4133, lng: -3.7082) — €
2. Bodega La Ardosa — Madrid, Calle de Colón 13 (lat: 40.4233, lng: -3.7032) — €€
3. Casa Dani — Madrid, Mercado de La Paz (lat: 40.4363, lng: -3.6882) — €€

Categories: Croquetas 🥟 | Tortilla 🍳 | Sardinas 🐟 | Postres 🍮

Dish Types:
- Croqueta de jamón (Croquetas)
- Croqueta de boletus (Croquetas)
- Tortilla española (Tortilla)

Dish Entries (10 total):
- Create varied entries across restaurants and dish types
- Include different scores (7.5–9.5 range), visibility mix, some with notes
- Cover both users and the group context
- Include at least 3 entries for "Croqueta de jamón" to make ranking meaningful

========================================================
11) FINAL CHECKLIST (ALL MUST PASS)
========================================================

✅ Adding a restaurant WITHOUT location shows validation error and blocks save
✅ AI search (Google Places) auto-fills location on restaurant creation
✅ Long-press on map (not tap) triggers "add restaurant here" dialog
✅ Map pins display in multiple styles: dot / category icon / photo / price / score
✅ puntuacion_general auto-calculates from filled sub-scores in real time
✅ Photo upload supports blob/file upload AND external URL (toggle)
✅ Groups table stores and displays created_at
✅ Adding dishes ALWAYS works — no silent failures
✅ Multiple dishes per restaurant ✅
✅ Decimal scores (0.0–10.0) ✅
✅ Restaurant score = average of all its dish scores (auto-calculated)
✅ Groups work (create, join, invite code) ✅
✅ All filters work (apply, reset, chips, counter) ✅
✅ Ranking by specific dish type works (e.g. "Mejor Croqueta de jamón") ✅
✅ Interactive map with custom pins works ✅
✅ CSV export works ✅
✅ Printable report works ✅
✅ Share link works ✅
✅ Seed data loads on first use ✅
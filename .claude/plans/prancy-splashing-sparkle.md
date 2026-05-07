# GastroRank: Plan de Finalización

> El plan anterior de Comunidad + Perfil ya fue implementado completamente según CHECKPOINT.md.
> El plan activo es `docs/PLAN_COMPLETION.md` en el repo.

## Context
Three areas of work remaining:
1. Authentication system (login/register/logout) — the app has zero auth, single hardcoded user
2. Redesign the "Perfil" screen with achievements, badges, inspiration lists, and ranking sharing
Plus efficiency/security improvements post-implementation.

---

## PHASE 1 — Database Schema Additions

**File:** `server/db/migrations/001_initial_schema.sql`

Add new tables (append at end):

```sql
-- Follows (mutual = both rows exist)
follows (follower_user_id FK users, followed_user_id FK users, created_at)
UNIQUE (follower_user_id, followed_user_id)

-- Reactions (1 per user per entry)
reactions (id, dish_entry_id FK dish_entries, user_id FK users,
           reaction_type TEXT CHECK IN ('quiero_probar','ya_probe','que_hambre','mejorable','paso'),
           created_at)
UNIQUE (dish_entry_id, user_id)

-- Comments
comments (id, dish_entry_id FK dish_entries, user_id FK users,
          text TEXT (max 500), mentions JSON, created_at)

-- Saved inspo lists
inspiration_lists (id, user_id FK users, name TEXT, is_default BOOLEAN DEFAULT 0, created_at)
inspiration_list_items (id, list_id FK inspiration_lists, dish_entry_id FK dish_entries,
                        tried BOOLEAN DEFAULT 0, tried_at, saved_at)
UNIQUE (list_id, dish_entry_id)

-- Recommendations
recommendations (id, from_user_id FK users, to_user_id FK users,
                 dish_entry_id FK dish_entries, seen BOOLEAN DEFAULT 0, created_at)

-- Achievements
achievements (id, user_id FK users,
              badge_type TEXT CHECK IN (10 badge types),
              unlocked_at, notified BOOLEAN DEFAULT 0)
UNIQUE (user_id, badge_type)
```

Run `npm run db:reset` to apply.

---

## PHASE 2 — Backend API Endpoints

**File:** `server/app.js`

Add routes:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/follows` | Get follows for current user |
| POST | `/api/follows` | Follow a user |
| DELETE | `/api/follows/:id` | Unfollow |
| GET | `/api/community/feed` | Paginated community feed (amigos/explorar), params: `tab`, `page`, `filters` |
| POST | `/api/reactions` | Add/update reaction |
| DELETE | `/api/reactions/:id` | Remove reaction |
| GET | `/api/comments/:entryId` | Get comments for entry |
| POST | `/api/comments` | Add comment |
| GET | `/api/inspiration-lists` | Get user's lists |
| POST | `/api/inspiration-lists` | Create list |
| POST | `/api/inspiration-list-items` | Save entry to list |
| PUT | `/api/inspiration-list-items/:id` | Mark tried / remove |
| POST | `/api/recommendations` | Send recommendation |
| GET | `/api/recommendations` | Get inbox recommendations |
| GET | `/api/achievements` | Get user achievements + streak |

---

## PHASE 3 — src/lib/api.js

Add client functions mirroring all new endpoints above.

---

## PHASE 4 — AppStateProvider additions

**File:** `src/providers/AppStateProvider.jsx`

Add to state:
- `follows`, `reactions`, `comments`, `inspirationLists`, `achievements`, `recommendations`

Add to bootstrap fetch (or lazy-load on screen visit).

Add methods:
- `followUser()`, `unfollowUser()`, `getMutualFollows()`
- `addReaction()`, `removeReaction()`
- `addComment()`
- `saveToList()`, `markTried()`, `removeFromList()`
- `createInspirationList()`
- `sendRecommendation()`, `markRecommendationSeen()`
- `checkAndUnlockAchievements()` — runs after any new dish entry

Add to `buildDerivedState()`:
- `mutualFollows` — users where both follow rows exist
- `weeklyStreak` — calculated from `dishEntries` created_at dates
- `userLevel` — computed from `achievements` count (0-2→Novato, 3-4→Foodie, etc.)

---

## PHASE 5 — Comunidad Screen (New)

**File to create:** `src/screens/ComunidadScreen.jsx`

Structure:
```
<ComunidadScreen>
  <SubTabs> [Amigos] [Explorar] </SubTabs>
  <FilterBar>
    chips: Categoría (multi), Tipo de plato (multi, dependent), Precio, Puntuación mínima, Fecha
    active filter chips row + "Resetear" button
  </FilterBar>

  {tab === 'amigos' && (
    <>
      {recommendations.unseen.length > 0 && <ParaTiSection />}  // horizontal scroll, max 5
      <CommunityGrid entries={friendEntries} />
    </>
  )}
  {tab === 'explorar' && <CommunityGrid entries={publicEntries} />}

  <Pagination prev/page-X-of-N/next />
</ComunidadScreen>
```

**Subcomponents to create:**

`src/components/community/CommunityGrid.jsx`
- 2-column CSS grid (not true masonry, use `column-count: 2` or CSS grid with `auto-rows`)
- Renders `CommunityCard` per entry

`src/components/community/CommunityCard.jsx`
- With photo: img fills top ~4:3
- Without photo: 80px colored placeholder (category color + emoji, centered)
- Content: dish name (bold, 2-line clamp), restaurant name (muted, truncate), score badge, author avatar + username, reaction summary (top 3 by count), 🔖 bookmark icon top-right
- `onClick` → opens EntryDetailModal

`src/components/community/EntryDetailModal.jsx` (bottom sheet)
- Full info: photo, dish name, restaurant (tappable), score + sub-scores breakdown, author + date, notes
- All 5 reactions with full labels + counts + user's current highlighted
- 🔖 "Guardar para inspo" button (orange)
- Comments section with @mention input
- "Ver restaurante completo →" link

`src/components/community/ReactionRow.jsx`
- Card mode: top 3 reactions as icons+count
- Modal mode: all 5 with full labels

`src/components/community/CommentInput.jsx`
- Text input with @mention autocomplete (mutual follows only, + @restaurante: + @plato: patterns)
- Autocomplete dropdown

`src/components/community/FilterBar.jsx` (community-specific filters)

`src/components/community/Pagination.jsx`

`src/components/community/ParaTiSection.jsx`
- Horizontal scroll of recommended cards (max 5)
- Disappears when all viewed/dismissed

**Empty states:**
- Amigos: 👥 text + "Buscar amigos →"
- Explorar (no filter match): 🍽 text + "Resetear filtros"

---

## PHASE 6 — Profile Screen Redesign

**File:** `src/screens/ProfileScreen.jsx` (full rewrite, keep existing data hooks)

New structure (top → bottom):

### 6.1 Header
- Avatar (72px circle, editable — tap opens picker "📷 Cámara / 🖼 Galería", blob upload)
- Username (bold) + Level chip (e.g. "⭐ Gourmet")
- Bio (inline editable, placeholder "Tu historia foodie...")
- Stats row: Platos · Restaurantes · Grupos
- Social row: Seguidores [N] · Siguiendo [N] → tapping opens user list modal

### 6.2 Active Group Banner
- "Puntuando en: [grupo] [emoji]" or "Sin grupo activo · Tap para elegir"
- Tap → group switcher

### 6.3 Badge Row
- 3 most recent unlocked badges as colored icons
- "Ver todos →" → opens AchievementsSheet (bottom sheet)

**AchievementsSheet subcomponent:**
- Section "Logros por hitos": 10 badges, unlocked=color, locked=gray+progress bar
- Section "Racha semanal": 🔥 X semanas, or prompt to add a dish
- Section "Nivel general": chip display

### 6.4 Stats Section (collapsible)
- "📊 Mis estadísticas" header (toggle)
- 7 data rows: avg score, fav category, most repeated dish, most visited restaurant, top city, best score entry, worst score entry

### 6.5 My Entries
- "🍽 Mis platos" section
- Filter chips: Todos / Con foto / +de 8 / Esta semana / Por categoría ▼
- Compact entry cards (~60px): dish name + restaurant + score badge + date + thumbnail
- 10 per page + "Ver más" button
- Tap → EntryDetailModal

### 6.6 My Groups
- Cards: group name + type chip + member avatars (max 4 + "+N") + role badge
- Actions: "🔗 Compartir" (invite code + QR modal + copy) + "Ver grupo →"
- "＋ Crear grupo" button

### 6.7 Inspiration Lists
- "🔖 Mis listas"
- Cards: list name (editable) + count + 3 photo thumbnails
- Tap → list detail (Por probar / Ya probados sub-sections, "✅ Ya lo probé" + "🗑 Quitar")
- "＋ Nueva lista" button
- Default "Para probar" list non-deletable

### 6.8 Share My Ranking
- "🏆 Compartir mi ranking"
- Step flow: content type → count → context → render card
- Rendered as styled div (HTML canvas optional if time allows)
- Buttons: "⬇ Descargar imagen" (html2canvas or dom-to-image) + "🔗 Copiar enlace" + "📤 Compartir" (Web Share API)

### 6.9 Settings (collapsible)
- Edit profile, default visibility, default pin style, notification toggles
- Catalog editor (moved from current location)
- Export CSV (move from ListsScreen)
- Active group selector
- "Cerrar sesión" (red)

---

## PHASE 7 — Navigation Update

**File:** `src/lib/constants.js`

Change nav item from `{ id: 'lists', label: 'Listas', icon: '📋' }` → `{ id: 'comunidad', label: 'Comunidad', icon: '🌍' }`

**File:** `src/App.jsx`

Replace `<ListsScreen />` render with `<ComunidadScreen />` for `comunidad` screen.

Note: ListsScreen.jsx is not deleted — its CSV export and filter logic migrates to ProfileScreen settings and AppStateProvider; the file can be archived.

---

## PHASE 8 — Achievement Unlock Logic

**File:** `src/providers/AppStateProvider.jsx`

After `createDishEntry()` resolves, call `checkAndUnlockAchievements()`:
- Queries local state for badge conditions
- If new badge unlocked: POST `/api/achievements`, set `notified=false`
- UI layer watches for `achievements` with `notified=false` → shows confetti toast → marks notified

Badge conditions (all computed from local state):
| Badge | Condition |
|-------|-----------|
| 🥟 Croquetero/a | ≥5 entries same dish type |
| 📍 Explorador/a | ≥10 distinct restaurants |
| 📸 Foodie visual | ≥10 entries with foto_url |
| 🌍 Sin fronteras | entries in ≥3 distinct cities (from restaurant addresses — parse city from direccion_texto) |
| 👑 Referente | ≥3 of user's dishes in community top 10 (requires public context data) |
| 🎯 Exigente | ≥20 entries with all 4 sub-scores filled |
| 🔁 Habitual | ≥5 entries at same restaurant |
| 🍽 Omnívoro/a | entries in ≥5 distinct categories |
| 💬 Social | received ≥10 reactions from others |
| 🏆 Top Chef | user has a dish ranked #1 in any category |

---

## PHASE 9 — Efficiency & Security Improvements

### Priority: Security
1. **Input sanitization** — Validate `mentions` JSON in comments (type enum, max length), prevent XSS in rendered mentions
2. **Rate limiting** — Add basic rate limiting headers / reject burst in `server/app.js` (simple counter per IP)
3. **SQL injection** — Audit all `execFile` sqlite3 calls; ensure all user values are parameterized (check current pattern)
4. **Visibility enforcement** — API feed endpoint must enforce `visibility='public'` for Explorar; `visibility` checks for Amigos
5. **Follow symmetry check** — Recommendations/Amigos feed must verify mutual follow at query time, not just client-side

### Priority: Performance
1. **Bootstrap payload size** — Currently loads ALL data upfront. Add lazy-loading for community feed, comments, reactions (fetch on screen visit)
2. **Derived state recalculation** — `buildDerivedState()` recalculates everything on every state change; memoize expensive parts with `useMemo` or split into smaller selectors
3. **Pagination in API** — Community feed endpoint must paginate at DB level (LIMIT/OFFSET), not filter in JS
4. **Avatar uploads** — Implement proper multipart form handling; currently schema has `avatar_url` as URL string — add blob-to-URL pipeline (store as base64 in SQLite or add a `/api/upload` endpoint)
5. **QR code generation** — Use `qrcode` npm package (lightweight, no canvas dependency needed for share modal)

### Priority: Minor
1. Add `loading` and `error` states to new API calls (currently many calls lack error UI)
2. Move `DEFAULT_FILTERS` to a single canonical location (currently in both `filters.js` and `AppStateProvider`)
3. Add `Content-Type: application/json` header validation in server for POST/PUT routes
4. Compress CSS — `App.css` has grown large; scope community/profile styles to their component files

---

## Critical Files Modified

| File | Change |
|------|--------|
| `server/db/migrations/001_initial_schema.sql` | Add 7 new tables |
| `server/app.js` | Add ~15 new API routes |
| `src/lib/api.js` | Add client functions |
| `src/lib/constants.js` | Nav rename + new enums |
| `src/providers/AppStateProvider.jsx` | New state, methods, derived |
| `src/App.jsx` | Route comunidad screen |
| `src/screens/ProfileScreen.jsx` | Full redesign |
| `src/screens/ComunidadScreen.jsx` | New file |
| `src/components/community/*.jsx` | ~8 new components |
| `src/App.css` | Community + profile styles |

---

## Verification

1. `npm run db:reset` → verify new tables exist
2. `npm run api:dev` + `npm run dev`
3. Comunidad tab appears in nav (🌍), Listas gone
4. Amigos/Explorar sub-tabs switch correctly
5. Pagination shows 12 cards, next/prev works
6. Filter bar chips filter results
7. Cards show placeholder for entries without photo
8. Tapping card opens EntryDetailModal
9. Reaction toggle (single per user, updates count)
10. 🔖 save adds to "Para probar" list → toast appears
11. Profile header: avatar tap opens picker, bio edits inline
12. Badge row → "Ver todos" → bottom sheet shows hitos + streak
13. Stats section collapses/expands
14. My entries: filters work, pagination works
15. Groups: share modal shows invite code + QR
16. Inspiration list: create new, mark tried, remove item
17. Share ranking: generates card, download as PNG works
18. Achievement unlock: add a dish entry that crosses a threshold → confetti toast

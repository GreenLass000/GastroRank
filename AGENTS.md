# Repository Guidelines

## Project Structure & Source of Truth
This repository is a Vite + React application with SQLite as the persistence layer for domain data. Frontend code lives in `src/`: `main.jsx` bootstraps the app, `App.jsx` is the current top-level entry, and shared styles start in `src/index.css` and `src/App.css`. Database artifacts live in `server/db/`, with schema files in `server/db/migrations/`, seed data in `server/db/seeds/`, and local runtime files in `server/db/data/`. Put imported assets in `src/assets/` and directly served files in `public/`. Project documentation is split between the repository root and `docs/`.

## Where To Look First
- `TODO.md`: full product brief and final acceptance criteria
- `AGENTS.md`: contributor rules, repository expectations, and document map
- `docs/CHECKPOINT.md`: current project memory, implemented scope, startup flow, and next recommended step
- `docs/ARQUITECTURA_SQLITE.md`: SQLite layout, commands, schema notes, and persistence rules
- `docs/CHECKLIST_TECNICO.md`: file-by-file and component-by-component implementation checklist
- `server/app.js`: local API over SQLite for frontend hydration and first write flows

When resuming the project after a gap or in a new chat, read `docs/CHECKPOINT.md` first, then `TODO.md`, then the relevant file in `docs/`. `docs/CHECKPOINT.md` is the source of truth for current continuity state and next recommended step. When work touches business logic, rankings, forms, persistence, maps, exports, edit flows, or item details, check `TODO.md` first, then use the corresponding document in `docs/` to decide order and scope. When work touches saved entities, schema, seed data, or public share tokens, inspect `server/db/` and `docs/ARQUITECTURA_SQLITE.md` before changing frontend code.
If `docs/CHECKPOINT.md` already says implementation is closed in code, do not restart a broad audit; limit the session to verification or targeted fixes.

## Current Continuity Snapshot
Current rediseño status for `Inicio`:
- `Milestone 1`: closed in code
- `Milestone 2`: closed in code
- `Milestone 3`: closed in code
- `Milestone 4`: closed in code
- `Milestone 5`: closed in code

Current next-step assumption:
- start from `docs/CHECKPOINT.md`
- if the environment has Node, run verification (`db:verify`, `lint`, `build`)
- otherwise limit the session to targeted fixes or visual corrections only
- do not reopen broad home milestones unless the task is a targeted fix or visual correction
- Comunidad + Perfil:
  - `Fase 5`: closed in code
  - `Fase 6`: closed in code
  - next natural block: `Fase 7` (navegación y cierre de migración de `Listas`)

Current files that matter most for the next block:
- `docs/CHECKPOINT.md`
- `docs/CHECKLIST_TECNICO.md`
- `src/screens/ProfileScreen.jsx`
- `src/screens/ComunidadScreen.jsx`
- `src/App.jsx`
- `src/lib/constants.js`
- `src/App.css`

## Current Map Stack
The project currently uses **Leaflet + OpenStreetMap** as the real map implementation for both the main map and the restaurant mini map. Do not assume Google Maps is the active provider unless a future task explicitly reintroduces it. Current map behavior that contributors should preserve:
- main map tries to center on user geolocation first
- if location permission is denied or unavailable, default center is Valladolid
- long-press on empty map creates a draft location for restaurant creation
- the restaurant mini map must stay centered on the selected point instead of zooming out to a world view
- pins cluster when zoomed out and open up naturally when zooming in
- the default pin style can be configured globally and overridden per restaurant
- the map must not jump back to a world view after selecting a new point
- map layers must stay below modal, toast, top bar, FAB, and bottom navigation

## Product Constraints That Contributors Must Respect
The app is a mobile-first Spanish-language PWA called **Ranking Gastronómico**. UI copy must be in Spanish. The color system is fixed: orange `#FF6B35`, purple `#7B2D8B`, green `#2ECC71`, red `#E74C3C`, and light backgrounds `#F8F9FA`. Every async action needs visible feedback: loading `"Cargando..."`, success `"Guardado ✅"`, and explicit error text. Do not introduce silent failures, horizontal scroll, or flows that take more than two taps to reach rankings.

## Data, UX, and Feature Expectations
Keep the data model in `TODO.md` exact: users, groups, group members, restaurants, categories, dish types, and dish entries. Required rules include:
- restaurants cannot be saved without `lat` and `lng`
- group creation must add the owner atomically
- `puntuacion_general` must auto-calculate from filled sub-scores only
- duplicate restaurants and duplicate dish entries must be detected before save
- every visible button must have a real implemented action or be removed
- every persisted entity exposed in the UI must end up with a real edit flow
- touching a main item card should open useful detail or lead to its canonical action
- filters, rankings, CSV export, printable report, share links, and seed data must keep working
- when geolocation is unavailable, the map UX must still remain usable with Valladolid as fallback center

SQLite is the source of truth for persisted domain entities. Use local storage only for UI-only state such as filters, theme, and temporary drafts unless a task explicitly requires database persistence. If a change affects rankings, maps, forms, or persistence, verify behavior against `TODO.md` before merging.

## Build, Lint, and Local Development
- `npm run dev`: start the local Vite server
- `npm run build`: create the production bundle in `dist/`
- `npm run preview`: preview the built app locally
- `npm run lint`: run ESLint
- `npm run api:dev`: start the local SQLite read API on port `3030`
- `npm run db:init`: create the SQLite schema in `server/db/data/ranking_gastronomico.sqlite`
- `npm run db:seed`: load the seed data into SQLite
- `npm run db:reset`: recreate the local SQLite database from schema + seed
- `npm run db:verify`: inspect tables and row counts

## Coding Style & Naming
Use function components, ES modules, and 2-space indentation. Prefer `PascalCase` for components, `camelCase` for functions and state, and descriptive Spanish labels for user-facing text. Follow `eslint.config.js`; do not leave unused variables unless intentionally prefixed for the configured ignore rule.

## Testing & Pull Requests
There is no automated test suite yet, so every change must pass `npm run lint` and `npm run build`. Add manual verification notes for mobile flows, persistence, and error handling in pull requests, plus screenshots for UI changes. Git history is not available here, so use clear conventional commits such as `feat: add ranking filters` or `fix: validate restaurant location`.

## Continuation Rule
Before starting any new implementation block, update or at least verify:
- `docs/CHECKPOINT.md`
- `docs/CHECKLIST_TECNICO.md`
- `AGENTS.md` when the current milestone status or recommended starting point changes

This repository should always preserve a resumable state for future Codex sessions.

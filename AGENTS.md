# Repository Guidelines

## Project Structure & Source of Truth
This repository is a Vite + React application with PostgreSQL + Drizzle ORM as the active persistence layer for domain data. Frontend code lives in `src/`: `main.jsx` bootstraps the app, `App.jsx` is the current top-level entry, and shared styles start in `src/index.css` and `src/App.css`. Database artifacts live in `server/db/`, with the live schema in `server/db/schema.js` and bootstrap SQL in `server/db/init.postgres.sql`. Put imported assets in `src/assets/` and directly served files in `public/`. Project documentation is split between the repository root and `docs/`.

## Where To Look First
- `TODO.md`: full product brief and final acceptance criteria
- `AGENTS.md`: contributor rules, repository expectations, and document map
- `docs/DESIGNED.md`: manual lock for the redesign stage (`designed: true|false`)
- `docs/CHECKPOINT.md`: current project memory and current closure state
- `docs/PLAN_FRONTEND_MAESTRO.md`: active master plan for the current frontend block
- `docs/CHECKLIST_TECNICO.md`: execution checklist for the active plan
- `server/app.js`: local API for frontend hydration, auth, social flows and share tokens

When resuming the project after a gap or in a new chat, read `docs/CHECKPOINT.md` first, then `docs/DESIGNED.md`, then `docs/PLAN_FRONTEND_MAESTRO.md`, then `docs/CHECKLIST_TECNICO.md`, then `TODO.md`, then the relevant file in `docs/`. `docs/CHECKPOINT.md` is the source of truth for current continuity state and next recommended step. `docs/DESIGNED.md` is the source of truth for whether the redesign phase is still open. When work touches business logic, rankings, forms, persistence, maps, exports, edit flows, or item details, check `TODO.md` first, then use the active plan documents in `docs/` to decide order and scope. When work touches saved entities, schema, seed data, auth/session, or public share tokens, inspect `server/db/` and `server/app.js` before changing frontend code.

## Current Continuity Snapshot
Current status:
- there is an active frontend block with a new master plan
- the repository is not in maintenance-only mode right now
- the current block combines modularization, visible UX fixes, technical debt and session hardening
- phase 0 is expected to stay closed unless continuity drifts again
- phases 1 to 3 may be in progress at the same time under separate ownership

Current next-step assumption:
- start from `docs/CHECKPOINT.md`
- then inspect `docs/DESIGNED.md`
- then continue with `docs/PLAN_FRONTEND_MAESTRO.md`
- then confirm whether the active ownership is `Fase 1`, `Fase 2` or `Fase 3`
- then execute only the owned phase block in `docs/CHECKLIST_TECNICO.md`
- do not reopen alternative broad plans while this one is active unless the user explicitly replaces it

Current files that matter most for the next block:
- `docs/DESIGNED.md`
- `docs/CHECKPOINT.md`
- `docs/PLAN_FRONTEND_MAESTRO.md`
- `docs/CHECKLIST_TECNICO.md`
- `TODO.md`
- `src/App.jsx`
- `src/providers/AppStateProvider.jsx`
- `src/screens/HomeScreen.jsx`
- `src/screens/RankingsScreen.jsx`
- `src/screens/MapScreen.jsx`
- `src/screens/ComunidadScreen.jsx`
- `src/screens/ProfileScreen.jsx`

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

PostgreSQL + Drizzle is the source of truth for persisted domain entities. Use local storage only for UI-only state such as filters, theme, and temporary drafts unless a task explicitly requires database persistence. If a change affects rankings, maps, forms, auth/session or persistence, verify behavior against `TODO.md` before merging.

## Build, Lint, and Local Development
- before assuming `node`/`npm` are unavailable, try exporting the environment PATH that includes the local Node install used in this workspace, for example:
  - `PATH=/home/marcos/.nvm/versions/node/v24.13.0/bin:$PATH`
- when running verification or local scripts in Codex sessions, prefer prefixing commands with that PATH so tools such as `npm`, `npx`, and `node` remain available without extra setup
- `npm run dev`: start the local Vite server
- `npm run build`: create the production bundle in `dist/`
- `npm run preview`: preview the built app locally
- `npm run lint`: run ESLint
- `npm run api:dev`: start the local API on port `3030`
- database artifacts and commands must be aligned with the current PostgreSQL + Drizzle setup in `server/db/`

## Coding Style & Naming
Use function components, ES modules, and 2-space indentation. Prefer `PascalCase` for components, `camelCase` for functions and state, and descriptive Spanish labels for user-facing text. Follow `eslint.config.js`; do not leave unused variables unless intentionally prefixed for the configured ignore rule.

## Testing & Pull Requests
There is no automated test suite yet, so every change must pass `npm run lint` and `npm run build`. Add manual verification notes for mobile flows, persistence, and error handling in pull requests, plus screenshots for UI changes. Git history is not available here, so use clear conventional commits such as `feat: add ranking filters` or `fix: validate restaurant location`.

## Continuation Rule
Before starting any new implementation block, update or at least verify:
- `docs/DESIGNED.md`
- `docs/CHECKPOINT.md`
- `docs/PLAN_FRONTEND_MAESTRO.md` if priorities or scope changed
- `docs/CHECKLIST_TECNICO.md`
- `AGENTS.md` when the current milestone status or recommended starting point changes

## Redesign Lock
- `docs/DESIGNED.md` must contain a single line with `designed: true` or `designed: false`.
- Default value is `designed: false`.
- While `designed: false`, contributors must treat the global redesign as still in progress.
- While `designed: false`, do not continue automatically with the phases in `docs/PLAN_FRONTEND_MAESTRO.md` or `docs/CHECKLIST_TECNICO.md`.
- The only exception is when the user explicitly asks to continue a phase or implement plan work anyway.
- The redesign is only considered closed when the user manually changes the file to `designed: true`.

This repository should always preserve a resumable state for future Codex sessions.

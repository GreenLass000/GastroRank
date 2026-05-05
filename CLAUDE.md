# Project Rules: Gastronomic Ranking App

## Context
- Language: English.
- Stack: React (Vite), Node.js, SQLite.
- No automated tests.

## Behavior
- Prioritize token efficiency and minimal output.
- Be concise; do not explain code unless asked.
- Make focused changes; avoid unnecessary refactors.
- Follow existing patterns and file structure.
- For persistence, validation, ranking, or seed changes: update `server/db/` first, then `src/lib/`, then UI.

## Conventions
- Use camelCase for variables/functions and PascalCase for components/providers.
- Use `useAppState()` as the app state interface.
- `AppStateProvider` is the single source of truth.
- Mutations go through context methods and `src/lib/api.js`.
- Derived state is computed in `buildDerivedState()`.
- Navigation is handled in `App.jsx` without a router.
- Persistent UI preferences use `usePersistentState` + `localStorage`.

## Architecture
- Raw entities: `users`, `groups`, `groupMembers`, `restaurants`, `categories`, `dishTypes`, `dishEntries`.
- Ranking contexts: `private`, `group`, `public`.
- Ranking modes: `dishType`, `category`, `restaurant`, `global`.
- Score = average of `sabor`, `textura`, `presentacion`, `calidad_precio`, ignoring nulls.
- Backend: `server/app.js` is a minimal Node HTTP server using `sqlite3` CLI via `execFile`.

## Key Files
- `src/providers/AppStateProvider.jsx` — app state
- `src/lib/api.js` — API calls
- `src/lib/ranking.js` — ranking logic
- `src/lib/scoring.js` — score calculation
- `src/lib/filters.js` — filters
- `src/lib/validation.js` — shared validation
- `server/app.js` — API server
- `server/db/migrations/001_initial_schema.sql` — schema

## Testing
- No automated tests exist.
- Do not assume or add tests unless requested.

## Useful Commands
- `npm run dev`
- `npm run api:dev`
- `npm run build`
- `npm run lint`
- `npm run db:init`
- `npm run db:seed`
- `npm run db:reset`
- `npm run db:verify`

## Local Development
- Run both:
  - `npm run dev`
  - `npm run api:dev`
- Frontend uses `VITE_API_BASE_URL`; if unset, it uses same-origin.
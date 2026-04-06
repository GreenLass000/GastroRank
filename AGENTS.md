# Repository Guidelines

## Project Structure & Source of Truth
This repository is a Vite + React application. App code lives in `src/`: `main.jsx` bootstraps the app, `App.jsx` is the current top-level entry, and shared styles start in `src/index.css` and `src/App.css`. Put imported assets in `src/assets/` and directly served files in `public/`. Project documentation is split between the repository root and `docs/`.

## Where To Look First
- `TODO.md`: full product brief and final acceptance criteria
- `AGENTS.md`: contributor rules, repository expectations, and document map
- `docs/PLAN_IMPLEMENTACION.md`: execution order from most critical to least critical
- `docs/CHECKLIST_TECNICO.md`: file-by-file and component-by-component implementation checklist
- `docs/MILESTONES.md`: recommended delivery sequence and commit/milestone plan

When work touches business logic, rankings, forms, persistence, maps, or exports, check `TODO.md` first, then use the corresponding document in `docs/` to decide order and scope.

## Product Constraints That Contributors Must Respect
The app is a mobile-first Spanish-language PWA called **Ranking Gastronómico**. UI copy must be in Spanish. The color system is fixed: orange `#FF6B35`, purple `#7B2D8B`, green `#2ECC71`, red `#E74C3C`, and light backgrounds `#F8F9FA`. Every async action needs visible feedback: loading `"Cargando..."`, success `"Guardado ✅"`, and explicit error text. Do not introduce silent failures, horizontal scroll, or flows that take more than two taps to reach rankings.

## Data, UX, and Feature Expectations
Keep the data model in `TODO.md` exact: users, groups, group members, restaurants, categories, dish types, and dish entries. Required rules include:
- restaurants cannot be saved without `lat` and `lng`
- group creation must add the owner atomically
- `puntuacion_general` must auto-calculate from filled sub-scores only
- duplicate restaurants and duplicate dish entries must be detected before save
- filters, rankings, CSV export, printable report, share links, and seed data must keep working

If a change affects rankings, maps, forms, or persistence, verify behavior against `TODO.md` before merging.

## Build, Lint, and Local Development
- `npm run dev`: start the local Vite server
- `npm run build`: create the production bundle in `dist/`
- `npm run preview`: preview the built app locally
- `npm run lint`: run ESLint

## Coding Style & Naming
Use function components, ES modules, and 2-space indentation. Prefer `PascalCase` for components, `camelCase` for functions and state, and descriptive Spanish labels for user-facing text. Follow `eslint.config.js`; do not leave unused variables unless intentionally prefixed for the configured ignore rule.

## Testing & Pull Requests
There is no automated test suite yet, so every change must pass `npm run lint` and `npm run build`. Add manual verification notes for mobile flows, persistence, and error handling in pull requests, plus screenshots for UI changes. Git history is not available here, so use clear conventional commits such as `feat: add ranking filters` or `fix: validate restaurant location`.

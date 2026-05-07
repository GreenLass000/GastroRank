# Plan de Finalización — GastroRank

**Fecha:** 2026-05-07  
**Estado base:** Docker Compose + PostgreSQL operativo. App carga pero es no funcional con DB vacía porque no existe flujo de creación de usuario ni sistema de autenticación.

---

## Contexto

La migración de SQLite → PostgreSQL con Drizzle ORM está completa. La app arranca y carga, pero tiene bloqueantes críticos que impiden usarla sin datos previos. El resto de la funcionalidad (Comunidad, Perfil, Rankings, Mapa) está implementada en código según `CHECKPOINT.md`, pero no ha sido verificada contra el nuevo backend PostgreSQL.

---

## Fase 1 — Autenticación y gestión de usuarios (bloqueante total)

La app no tiene ningún sistema de auth. El usuario activo es siempre `state.users[0]` — primer registro de la tabla. Con DB vacía, nada funciona. Con varios usuarios registrados, no hay forma de cambiar de cuenta.

### 1.1 Esquema: añadir campos de auth a la tabla `users`

**Archivos:** `server/db/schema.js`, `server/db/init.postgres.sql`

Añadir:
```sql
email        TEXT UNIQUE,         -- identificador de login (opcional en registro social)
password_hash TEXT,               -- bcrypt hash; NULL si solo usa username
bio          TEXT,                -- ya usado por ProfileScreen
```

No se almacena contraseña en texto plano. Usar `bcrypt` (npm: `bcryptjs`) en el backend.

---

### 1.2 Backend: endpoints de autenticación

**Archivo:** `server/app.js`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Crea usuario con `nombre` + `email` + `password`. Devuelve `{ user, token }` |
| `POST` | `/api/auth/login` | Login con `email` + `password`. Devuelve `{ user, token }` |
| `POST` | `/api/auth/logout` | Invalida token (si hay tabla de sesiones) o solo frontend |
| `GET` | `/api/auth/me` | Devuelve usuario actual desde token |

**Estrategia de sesión — JWT simple:**
- Token JWT firmado con `JWT_SECRET` (env var)
- Almacenado en `localStorage` en el cliente
- Enviado como `Authorization: Bearer <token>` en cada request
- Sin tabla de sesiones en DB (stateless); para invalidar basta con borrar en cliente
- Añadir `npm install jsonwebtoken bcryptjs`

**Middleware de auth:**
```js
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Invalid token' }) }
}
```

Aplicar `requireAuth` a todas las rutas protegidas (todo excepto `/api/bootstrap` público y `/api/auth/*`).

---

### 1.3 AppStateProvider: gestión de sesión

**Archivo:** `src/providers/AppStateProvider.jsx`

- Al iniciar, leer `localStorage.getItem('auth_token')`
- Si existe, llamar `GET /api/auth/me` para validar y obtener el usuario actual
- Si no hay token → estado `{ currentUser: null, authChecked: true }`
- Añadir métodos: `login(email, password)`, `register(nombre, email, password)`, `logout()`
- `logout()`: borra token de `localStorage`, resetea estado a vacío
- Reemplazar `state.users[0]` por el usuario autenticado como `currentUser`

Añadir a `src/lib/api.js`:
```js
export function authRegister(payload) { return requestJson('/api/auth/register', { method: 'POST', body: payload }) }
export function authLogin(payload) { return requestJson('/api/auth/login', { method: 'POST', body: payload }) }
export function authMe(token) { return fetchJson('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }) }
```

Todas las funciones de `api.js` deben incluir el token en headers. Crear helper:
```js
function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

---

### 1.4 UI: pantalla de autenticación (`AuthScreen`)

**Archivo nuevo:** `src/screens/AuthScreen.jsx`

Se muestra cuando `authChecked === true && currentUser === null` (en `src/App.jsx`).

**Estructura (tab login / registro):**

```
┌─────────────────────────────┐
│        🍽️  GastroRank        │
│                             │
│  [Iniciar sesión] [Registrarse]  ← tabs
│                             │
│  Login:                     │
│   Email _______________     │
│   Contraseña ___________    │
│   [Entrar]                  │
│                             │
│  Registro:                  │
│   Nombre _______________    │
│   Email _______________     │
│   Contraseña ___________    │
│   [Crear cuenta]            │
└─────────────────────────────┘
```

- Reutilizar patrón de `ProfileForm`: `<label className="field">` + estado `{ tone, message }` para errores
- Validar: email formato válido, contraseña ≥ 8 caracteres, nombre no vacío
- En éxito: guarda token en `localStorage`, llama a `bootstrapApp()` para cargar datos del usuario

**Archivo:** `src/App.jsx`

```jsx
// Guardia de auth
if (!authChecked) return <LoadingScreen />           // validando token
if (!currentUser) return <AuthScreen />              // no autenticado
return <MainApp />                                    // app normal
```

---

### 1.5 UI: logout y gestión de cuenta en `ProfileScreen`

**Archivo:** `src/screens/ProfileScreen.jsx`

En la sección de ajustes (ya existe, líneas ~1155-1229), añadir al final:

```
──────────────────────────────
Cuenta
  Email: usuario@example.com
  [Cambiar contraseña]
  ──────────
  [Cerrar sesión]  ← botón rojo, llama logout()
```

**Cambiar contraseña** abre un `ModalSheet` con campos: contraseña actual + nueva + confirmar.

Endpoint: `PUT /api/auth/password` (requiere token + `{ currentPassword, newPassword }`).

---

### 1.6 `ProfileScreen` — división por cero con historial vacío

**Problema:** Las 7 métricas de estadísticas calculan promedios sobre `currentUserEntries`. Si está vacío, produce `NaN` / `Infinity`.

**Archivo:** `src/screens/ProfileScreen.jsx`

**Fix:** Guardar con `|| 0` o `|| '—'` todas las métricas derivadas. Mostrar `'—'` cuando no hay datos suficientes.

---

## Fase 2 — Bugs documentados en `docs/BUGS.md`

### 2.1 `calculateAverageScore` dilución por null (crítico)

**Archivo:** `src/lib/scoring.js:13-15`

```js
// Fix:
const valid = entries.filter(e => e.puntuacion_general != null && Number.isFinite(e.puntuacion_general))
if (valid.length === 0) return null
return Number((valid.reduce((s, e) => s + e.puntuacion_general, 0) / valid.length).toFixed(1))
```

---

### 2.2 `MapView` — mapa destruido y recreado en cada cambio de viewport

**Archivo:** `src/components/map/MapView.jsx:467`

```js
// Fix: eliminar controlledCenter e initialZoom del array de deps del init effect
}, [mode])
```

---

### 2.3 `MapView` — `invalidateSize` sin array de deps

**Archivo:** `src/components/map/MapView.jsx:537-547`

```js
// Fix: añadir []
}, [])
```

---

### 2.4 `getScoreTone` — null devuelve 'bad'

**Archivo:** `src/lib/scoring.js:26-36`

```js
export function getScoreTone(score) {
  if (score == null || !Number.isFinite(score)) return 'neutral'
  if (score >= 8) return 'good'
  if (score >= 5) return 'mid'
  return 'bad'
}
```

Añadir en `App.css`:
```css
.ranking-card__score--neutral { background: var(--color-neutral, #9ca3af); }
```

---

### 2.5 GPS leak en share token

**Archivo:** `src/screens/RankingsScreen.jsx:394-398`

```js
// Fix: omitir filterOrigin del payload
filters: {
  ...activeFilters,
  // filterOrigin omitido — privacidad del autor
},
```

---

### 2.6 `buildRestaurantRankings` con arrays vacíos

**Archivo:** `src/lib/ranking.js:202-208`

Pasar `categories` y `dishTypes` reales en lugar de `[]`. Revisar todos los call sites de `buildRestaurantRankings` y `buildSimpleRestaurantRankings` para asegurarse.

---

### 2.7 `User-Agent` en peticiones Nominatim

**Archivo:** `src/lib/maps.js:200-207`

```js
headers: {
  Accept: 'application/json',
  'User-Agent': 'GastroRank/1.0 (gastrorank@example.com)',
},
```

---

### 2.8 Doble cálculo de score en `buildMapRestaurants` (minor)

**Archivo:** `src/screens/MapScreen.jsx:97-98`

```js
const avgScore = calculateAverageScore(restaurantEntries)
// ...
restaurant_score: avgScore,
score: avgScore,
```

---

## Fase 3 — Verificación de compatibilidad PostgreSQL

El código de `server/app.js` fue migrado a Drizzle ORM sobre PostgreSQL. Hay que verificar que todos los endpoints existentes funcionan correctamente con el nuevo esquema.

### 3.1 Ejecutar lint y build

```bash
npm run lint
npm run build
```

Resolver todos los errores antes de continuar.

### 3.2 Verificar esquema PostgreSQL vs Drizzle schema

Comparar `server/db/init.postgres.sql` con `server/db/schema.js` para asegurarse de que:
- Todas las tablas están en ambos archivos
- Tipos de datos coinciden (especialmente `REAL` vs `real()`, `JSONB` vs `jsonb()`)
- `puntuacion_general` como columna generada funciona en INSERT/SELECT

### 3.3 Endpoints de `server/app.js` — audit de compatibilidad

Verificar que los endpoints de Fase 2 (comunidad/social) del plan `prancy-splashing-sparkle` fueron también migrados a Drizzle. El CHECKPOINT indica que estaban en SQLite antes de la migración.

Endpoints que deben existir y usar Drizzle:
- `GET/POST/DELETE /api/follows`
- `GET /api/community/feed`
- `POST/DELETE /api/reactions`
- `GET/POST /api/comments/:entryId`
- `GET/POST /api/inspiration-lists`
- `POST/PUT /api/inspiration-list-items/:id`
- `POST/GET /api/recommendations`
- `GET /api/achievements`

---

## Fase 4 — UX vacíos y estados de carga

### 4.1 Empty states en pantallas principales

Cuando el usuario existe pero no tiene datos:

| Pantalla | Estado vacío |
|----------|--------------|
| Home | "Aún no has añadido ningún plato. ¡Empieza puntuando!" + botón "Añadir plato" |
| Rankings | "Sin datos para mostrar en este contexto" |
| Mapa | "No hay restaurantes registrados aún" |
| Comunidad > Amigos | "No sigues a nadie todavía. Busca amigos →" |
| Comunidad > Explorar | "Nadie ha publicado entradas públicas aún" |
| Perfil > Mis platos | "Aún no has añadido platos" |

### 4.2 Loading states

Las llamadas a la API no tienen indicador de carga en varios flujos. Añadir spinner o skeleton en:
- Bootstrap inicial (pantalla de carga)
- Feed de Comunidad al cambiar tab
- Carga diferida de datos sociales en Perfil

---

## Fase 5 — Pendientes de Fase 9 (del plan original)

Según `CHECKPOINT.md`, estos puntos de Fase 9 siguen pendientes:

### 5.1 Paginación SQL real en feed de Comunidad

**Archivo:** `server/app.js` — endpoint `GET /api/community/feed`

Añadir `LIMIT` y `OFFSET` a nivel de Drizzle:
```js
.limit(pageSize).offset(page * pageSize)
```

Devolver `{ items, total, page, pageSize }` en la respuesta.

### 5.2 Pipeline de uploads de avatar/imagen

**Problema actual:** `avatar_url` y `foto_url` esperan una URL string, pero el frontend puede enviar un blob/base64.

**Opción recomendada:** Añadir endpoint `POST /api/upload` que recibe `multipart/form-data`, guarda el archivo en `./uploads/` (volumen Docker), y devuelve la URL relativa `/uploads/<uuid>.<ext>`.

Nginx ya necesitaría servir ese directorio o proxiarlo al API.

### 5.3 Partición de `App.css`

`App.css` ha crecido a más de 2000 líneas. Mover estilos a archivos por componente:
- `src/components/community/Community.css`
- `src/screens/ProfileScreen.css`
- `src/screens/ComunidadScreen.css`

Esto es mejora de mantenibilidad, no bloqueante.

---

## Orden de ejecución recomendado

```
Fase 1.1 → 1.2 → 1.3 → 1.4 → 1.5   (auth completo, app usable)
Fase 1.6                               (profile safe con historial vacío)
Fase 2.1 → 2.4                        (scoring correcto)
Fase 2.2 → 2.3                        (mapa estable)
Fase 3.1 (lint + build)
Fase 3.2 → 3.3                        (verificar backend PostgreSQL)
Fase 2.5 → 2.6 → 2.7                 (bugs medium)
Fase 4.1 → 4.2                        (UX vacíos y loading)
Fase 5.1 → 5.2 → 5.3                 (mejoras no bloqueantes)
```

---

## Dependencias externas nuevas

```bash
npm install jsonwebtoken bcryptjs
```

Añadir a `Dockerfile.api`:
```dockerfile
# ya incluido en COPY server/ + npm install
```

Añadir a `.env.example`:
```
JWT_SECRET=change_me_in_production
```

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `server/app.js` | Auth endpoints, middleware `requireAuth`, `POST /api/users` eliminado (reemplazado por register) |
| `server/db/schema.js` | Añadir `email`, `password_hash`, `bio` a `users` |
| `server/db/init.postgres.sql` | Añadir columnas de auth a tabla `users` |
| `src/lib/api.js` | `authRegister`, `authLogin`, `authMe`, header helper `authHeaders()` |
| `src/providers/AppStateProvider.jsx` | Gestión de token, `login()`, `register()`, `logout()`, guard `authChecked` |
| `src/App.jsx` | Guard de auth: `LoadingScreen` → `AuthScreen` → app |
| `src/screens/AuthScreen.jsx` | **Nuevo** — pantalla login + registro |
| `src/screens/ProfileScreen.jsx` | Sección "Cuenta" con logout + cambiar contraseña; guards división por cero |
| `src/lib/scoring.js` | Fix `calculateAverageScore` + `getScoreTone` |
| `src/lib/ranking.js` | Pass real categories/dishTypes |
| `src/lib/maps.js` | User-Agent header |
| `src/components/map/MapView.jsx` | Fix deps de init effect e `invalidateSize` |
| `src/screens/RankingsScreen.jsx` | Fix GPS leak en share |
| `src/screens/MapScreen.jsx` | Fix doble cálculo score |
| `src/App.css` | Clase `.ranking-card__score--neutral`, estilos `AuthScreen` |
| `docker-compose.yml` | Añadir `JWT_SECRET` a env del servicio `api` |

# Bugs

## Critical

### 1. `calculateAverageScore` counts null-score entries in the denominator
**File:** `src/lib/scoring.js:17-24`

`null` coerces to `0` in JS arithmetic, so `sum + null === sum`. However, `entries.length` still counts those entries, silently diluting the result.

```js
// entries = [{puntuacion_general: 8}, {puntuacion_general: null}]
// total = 8 + 0 = 8, length = 2 → returns 4.0 instead of 8.0
const total = entries.reduce((sum, entry) => sum + entry.puntuacion_general, 0)
return Number((total / entries.length).toFixed(1))
```

**Fix:** filter out null/NaN before reducing.

---

### 2. `MapView` map is destroyed and re-created on every viewport change
**File:** `src/components/map/MapView.jsx:467`

The map initialisation effect lists `controlledCenter` and `initialZoom` as dependencies. Its cleanup calls `map.remove()` and sets `mapRef.current = null`. Because `controlledCenter` is a freshly created object every time the `center` prop changes reference (even for the same lat/lng), the effect's cleanup fires and the entire Leaflet map is torn down and rebuilt on every call to `requestViewport` in `MapScreen`.

```js
}, [controlledCenter, initialZoom, mode])   // <-- controlledCenter here is the culprit
```

**Fix:** remove `controlledCenter` (and `initialZoom`) from the init effect deps. The initial `setView` call inside is already guarded by `if (!mapContainerRef.current || mapRef.current)` — the re-run adds nothing useful. The separate pan/fly effect at line 503 handles subsequent center changes correctly.

---

### 3. `MapView` `invalidateSize` effect runs on every render
**File:** `src/components/map/MapView.jsx:537-547`

```js
useEffect(() => {
  const map = mapRef.current
  if (!map) { return }
  window.setTimeout(() => { map.invalidateSize() }, 0)
})  // ← no dependency array
```

No dependency array means this fires after every render of `MapView` or any of its parents, calling `invalidateSize()` on every paint cycle. Combined with the map re-init bug above this makes the map screen very jittery.

**Fix:** add `[]` deps (or tie it to a `ResizeObserver` if dynamic resizing is needed).

---

## Medium

### 4. `getScoreTone` returns `'bad'` for null/undefined scores
**File:** `src/lib/scoring.js:26-36`

```js
export function getScoreTone(score) {
  if (score >= 8) { return 'good' }
  if (score >= 5) { return 'mid' }
  return 'bad'
}
```

`null >= 8` and `null >= 5` are both `false`, so null/undefined/NaN all fall through to `'bad'`. Restaurants with no entries get a red score badge (`.ranking-card__score--bad`) instead of a neutral style.

**Fix:** add a guard at the top: `if (score == null || !Number.isFinite(score)) return 'neutral'` and add the corresponding CSS class.

---

### 5. GPS coordinates leak into public share token
**File:** `src/screens/RankingsScreen.jsx:394-398`

```js
filters: {
  ...activeFilters,
  filterOrigin,   // ← user's lat/lng embedded in a public token
},
```

The user's current geolocation is serialised into a token stored in the database and shared publicly via a URL. This is a privacy issue.

**Fix:** omit `filterOrigin` from the share payload; the viewer's own geolocation should be applied when they open the report, not the author's.

---

### 6. `buildRestaurantRankings` passes empty `categories`/`dishTypes` into `buildSimpleRestaurantRankings`
**File:** `src/lib/ranking.js:202-208`

```js
return buildSimpleRestaurantRankings({
  categories: [],   // lookups will always miss
  dishTypes: [],
  entries: filteredEntries,
  restaurants,
})
```

Every item built by `buildSimpleRestaurantRankings` derives `categoryName`, `categoryIcon`, and `dishTypeName` from those lookups. With empty arrays the lookups are empty objects and every item gets the fallback strings `'Categoría'` / `'🍽️'` / `'Plato'` regardless of actual data.

**Fix:** pass the real `categories` and `dishTypes` arrays (they are available at every call site).

---

### 7. Missing `User-Agent` header on Nominatim requests
**File:** `src/lib/maps.js:200-207`

[Nominatim's usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires a valid `User-Agent`. Requests without one may be rate-limited or blocked.

```js
const response = await fetch(url.toString(), {
  method: 'GET',
  headers: { Accept: 'application/json' },  // no User-Agent
  signal,
})
```

**Fix:** add `'User-Agent': 'GastroRank/1.0'` (or derive from `package.json`) to the headers.

---

## Minor

### 8. Duplicate `restaurant_score` and `score` fields in `buildMapRestaurants`
**File:** `src/screens/MapScreen.jsx:97-98`

```js
restaurant_score: calculateAverageScore(restaurantEntries),
score: calculateAverageScore(restaurantEntries),
```

`calculateAverageScore` is called twice for the same set of entries and the result stored under two different keys. Only `score` is used for pins/popups; `restaurant_score` is used for the detail sheet and list sort. Should be computed once.

---

### 9. `MapView` topline renders the same string for both provider branches
**File:** `src/components/map/MapView.jsx:728`

```js
<span>{instructionLabel || (provider === 'leaflet-osm' ? 'Mapa' : 'Mapa')}</span>
```

Both sides of the ternary are `'Mapa'`. `instructionLabel` is never passed from `MapScreen` either, so this always renders `'Mapa'`. The conditional is dead code.

---

### 10. `buildMapBounds` has inconsistent indentation in the early-return block
**File:** `src/lib/maps.js:262-269`

```js
if (validPoints.length === 0) {
      return {             // ← 6-space indent instead of 4
      minLat: ...
```

Cosmetic only, but breaks the consistent 2-space indent used everywhere else.

---

### 11. `allowAutoLocate` prop in `MapView` is never used
**File:** `src/components/map/MapView.jsx:222` / `src/screens/MapScreen.jsx`

`MapView` accepts `allowAutoLocate = false` and has an effect that fires when it is `true`, but `MapScreen` never passes the prop. The geolocation inside that effect is therefore unreachable dead code. The actual GPS logic lives in `AppStateProvider`.

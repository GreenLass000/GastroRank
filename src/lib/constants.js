export const APP_NAME = 'Ranking Gastronómico'
export const STORAGE_KEYS = {
  authToken: 'ranking-gastronomico:auth-token:v1',
  filters: 'ranking-gastronomico:filters:v1',
  themeMode: 'ranking-gastronomico:theme-mode:v1',
  defaultPinStyle: 'ranking-gastronomico:pin-style:v2',
  restaurantPinStyleOverrides: 'ranking-gastronomico:pin-style-overrides:v1',
  rankingsRecentDishTypes: 'ranking-gastronomico:rankings-recent-dish-types:v1',
  mapOnboardingSeen: 'ranking-gastronomico:map-onboarding-seen:v1',
}

export const BRAND_COLORS = {
  orange: '#FF6B35',
  purple: '#7B2D8B',
  green: '#2ECC71',
  red: '#E74C3C',
  light: '#F8F9FA',
}

export const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: 'Inicio' },
  { id: 'community', icon: '✨', label: 'Explorar' },
  { id: 'map', icon: '🗺️', label: 'Mapa' },
  { id: 'rankings', icon: '🏆', label: 'Rankings' },
  { id: 'profile', icon: '👤', label: 'Perfil' },
]

export const RANKING_CONTEXTS = [
  { id: 'private', label: 'Mi ranking' },
  { id: 'group', label: 'Mi grupo' },
  { id: 'public', label: 'Comunidad' },
]

export const RANKING_TYPES = [
  'Por categoría',
  'Por tipo de plato',
  'Global',
  'Por restaurante',
]

export const RANKING_MODES = [
  { id: 'category', label: 'Por categoría' },
  { id: 'dishType', label: 'Por tipo de plato' },
  { id: 'global', label: 'Global' },
]

export const GLOBAL_RANKING_VIEWS = [
  { id: 'dish', label: 'Por plato' },
  { id: 'category', label: 'Por categoría' },
  { id: 'restaurant', label: 'Por restaurante' },
]

export const CATEGORY_PREVIEW = [
  { id: 'croquetas', icon: '🥟', label: 'Croquetas' },
  { id: 'tortilla', icon: '🍳', label: 'Tortilla' },
  { id: 'sardinas', icon: '🐟', label: 'Sardinas' },
  { id: 'postres', icon: '🍮', label: 'Postres' },
]

export const PIN_STYLES = [
  'Nombre',
  'Categoría',
  'Precio',
  'Puntuación',
]

export const DEFAULT_PIN_STYLE = 'Puntuación'

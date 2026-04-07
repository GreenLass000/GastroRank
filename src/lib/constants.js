export const APP_NAME = 'Ranking Gastronómico'
export const STORAGE_KEYS = {
  filters: 'ranking-gastronomico:filters:v1',
  defaultPinStyle: 'ranking-gastronomico:pin-style:v1',
  restaurantPinStyleOverrides: 'ranking-gastronomico:pin-style-overrides:v1',
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
  { id: 'rankings', icon: '🏆', label: 'Rankings' },
  { id: 'map', icon: '🗺️', label: 'Mapa' },
  { id: 'lists', icon: '📋', label: 'Listas' },
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

export const CATEGORY_PREVIEW = [
  { id: 'croquetas', icon: '🥟', label: 'Croquetas' },
  { id: 'tortilla', icon: '🍳', label: 'Tortilla' },
  { id: 'sardinas', icon: '🐟', label: 'Sardinas' },
  { id: 'postres', icon: '🍮', label: 'Postres' },
]

export const PIN_STYLES = [
  'Punto',
  'Categoría',
  'Foto',
  'Precio',
  'Score',
]

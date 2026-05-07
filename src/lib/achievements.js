export const ACHIEVEMENT_TYPES = [
  'croquetero',
  'exploradora',
  'foodie_visual',
  'sin_fronteras',
  'referente',
  'exigente',
  'habitual',
  'omnivoro',
  'social',
  'top_chef',
]

export const ACHIEVEMENT_META = {
  croquetero: {
    icon: '🥟',
    title: 'Croquetero/a',
    description: 'Has puntuado al menos cinco veces el mismo tipo de plato.',
  },
  exploradora: {
    icon: '📍',
    title: 'Explorador/a',
    description: 'Ya has valorado platos en diez restaurantes distintos.',
  },
  foodie_visual: {
    icon: '📸',
    title: 'Foodie visual',
    description: 'Tu historial ya suma diez platos con foto.',
  },
  sin_fronteras: {
    icon: '🌍',
    title: 'Sin fronteras',
    description: 'Has registrado actividad en al menos tres ciudades distintas.',
  },
  referente: {
    icon: '👑',
    title: 'Referente',
    description: 'Tres de tus platos están dentro del top 10 de la comunidad.',
  },
  exigente: {
    icon: '🎯',
    title: 'Exigente',
    description: 'Has completado veinte valoraciones con las cuatro subnotas llenas.',
  },
  habitual: {
    icon: '🔁',
    title: 'Habitual',
    description: 'Has valorado al menos cinco platos en el mismo restaurante.',
  },
  omnivoro: {
    icon: '🍽️',
    title: 'Omnívoro/a',
    description: 'Has tocado cinco categorías gastronómicas distintas.',
  },
  social: {
    icon: '💬',
    title: 'Social',
    description: 'Tus platos han recibido diez reacciones de otras personas.',
  },
  top_chef: {
    icon: '🏆',
    title: 'Top Chef',
    description: 'Tienes un plato número uno dentro de alguna categoría pública.',
  },
}

export function getAchievementMeta(badgeType) {
  return (
    ACHIEVEMENT_META[badgeType] ?? {
      icon: '🏅',
      title: badgeType,
      description: 'Logro desbloqueado.',
    }
  )
}

export function getAchievementTitle(badgeType) {
  return getAchievementMeta(badgeType).title
}

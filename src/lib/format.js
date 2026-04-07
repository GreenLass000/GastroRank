export function formatScore(score) {
  if (typeof score !== 'number') {
    return '0.0'
  }

  return score.toFixed(1)
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateString))
}

export function formatRelativePrice(price) {
  if (typeof price !== 'number') {
    return 'Sin precio'
  }

  return `${price.toFixed(2)} €`
}

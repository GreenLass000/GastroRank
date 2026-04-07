export function calculateGeneralScore(entry) {
  const values = [
    entry.sabor,
    entry.textura,
    entry.presentacion,
    entry.calidad_precio,
  ].filter((value) => typeof value === 'number')

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(1))
}

export function calculateAverageScore(entries) {
  if (entries.length === 0) {
    return null
  }

  const total = entries.reduce((sum, entry) => sum + entry.puntuacion_general, 0)
  return Number((total / entries.length).toFixed(1))
}

export function getScoreTone(score) {
  if (score >= 8) {
    return 'good'
  }

  if (score >= 5) {
    return 'mid'
  }

  return 'bad'
}

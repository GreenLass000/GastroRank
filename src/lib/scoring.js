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
  const validScores = entries
    .map((entry) => entry?.puntuacion_general)
    .filter((score) => score !== null && score !== undefined)
    .map((score) => Number(score))
    .filter((score) => Number.isFinite(score))

  if (validScores.length === 0) {
    return null
  }

  const total = validScores.reduce((sum, score) => sum + score, 0)
  return Number((total / validScores.length).toFixed(1))
}

export function getScoreTone(score) {
  if (!Number.isFinite(score)) {
    return 'neutral'
  }

  if (score >= 8) {
    return 'good'
  }

  if (score >= 5) {
    return 'mid'
  }

  return 'bad'
}

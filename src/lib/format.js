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

export function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return 'Sin distancia'
  }

  if (distanceMeters < 1000) {
    return `${new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 0,
    }).format(Math.round(distanceMeters))} m`
  }

  const maximumFractionDigits =
    distanceMeters < 10000 && distanceMeters % 1000 !== 0 ? 1 : 0

  return `${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(distanceMeters / 1000)} km`
}

export function formatShortAddress(address) {
  const normalizedAddress = String(address ?? '')
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalizedAddress) {
    return 'Sin dirección'
  }

  const addressParts = normalizedAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (addressParts.length <= 1) {
    return addressParts[0] || normalizedAddress
  }

  return addressParts.slice(0, 2).join(' · ')
}

export function formatStreetAddress(address) {
  const normalizedAddress = String(address ?? '')
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalizedAddress) {
    return 'Sin dirección'
  }

  const firstPart = normalizedAddress.split(',')[0]?.trim() || normalizedAddress
  const withoutPrefix = firstPart.replace(
    /^(calle|c\/|avenida|avda\.?|plaza|paseo|ronda|camino|travesia|travesía|via|vía)\s+(de|del|de la|de los|de las)?\s*/i,
    '',
  )
  const compactStreet = withoutPrefix.trim() || firstPart
  const numberMatch = compactStreet.match(/(.+?)\s+(\d+[A-Za-zºª-]*)$/)

  if (!numberMatch) {
    return compactStreet
  }

  return `${numberMatch[1].trim()}, ${numberMatch[2].trim()}`
}

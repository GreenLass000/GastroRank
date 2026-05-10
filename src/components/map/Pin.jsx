import { formatScore } from '../../lib/format.js'
import { getScoreTone } from '../../lib/scoring.js'

function renderPinContent(marker, pinStyle) {
  switch (pinStyle) {
    case 'Categoría':
      return <span className="map-pin__emoji">{marker.categoryIcon || '🍽️'}</span>
    case 'Foto':
      return marker.cover_photo_url ? (
        <img
          className="map-pin__photo"
          src={marker.cover_photo_url}
          alt={`Foto de ${marker.nombre}`}
        />
      ) : (
        <span className="map-pin__emoji">🍽️</span>
      )
    case 'Precio':
      return <span className="map-pin__text">{marker.precio_rango || '€'}</span>
    case 'Score':
      return (
        <span className="map-pin__text">
          {typeof marker.score === 'number' ? formatScore(marker.score) : '0.0'}
        </span>
      )
    default:
      return <span className="map-pin__dot" aria-hidden="true" />
  }
}

export function Pin({ isActive, marker, onSelect, pinStyle, position }) {
  const tone = getScoreTone(marker.score)

  return (
    <button
      aria-label={`Ver ${marker.nombre}`}
      className={`map-pin map-pin--${tone}${isActive ? ' map-pin--active' : ''}`}
      data-map-marker="true"
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
      }}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(marker.id)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      <span className="map-pin__bubble">{renderPinContent(marker, pinStyle)}</span>
      <span className="map-pin__label">{marker.nombre}</span>
    </button>
  )
}

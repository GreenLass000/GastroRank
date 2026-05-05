import { formatScore } from '../../lib/format.js'

export function ParaTiSection({ items, onOpen }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="community-recommendations">
      <div className="section-header">
        <h2>Para ti</h2>
      </div>
      <div className="community-recommendations__scroll">
        {items.map((item) => (
          <button
            key={item.id}
            className="community-recommendation-card"
            type="button"
            onClick={() => onOpen?.(item)}
          >
            <strong>{item.entry.nombre_plato ?? item.entry.dishType?.nombre ?? 'Plato'}</strong>
            <p>{item.entry.restaurant?.nombre ?? 'Restaurante'}</p>
            <p>
              Te lo manda {item.fromUser?.nombre ?? 'alguien'} ·{' '}
              {formatScore(item.entry.puntuacion_general ?? 0)}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

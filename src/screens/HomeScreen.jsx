import { useState } from 'react'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatScore } from '../lib/format.js'
import { getScoreTone } from '../lib/scoring.js'

export function HomeScreen({ onNavigate, onOpenEntity, onOpenSearch }) {
  const { categories, latestEntries, rankingContexts, restaurantsByScore } =
    useAppState()
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '')

  const topByCategory = rankingContexts.private.dishType.find(
    (entry) => entry.categoryId === activeCategoryId,
  )

  return (
    <section className="screen" aria-label="Pantalla de inicio">
      <article className="screen__hero">
        <h2>Descubre, puntúa y compara tus platos favoritos</h2>
        <p>
          La home ya consume datos reales y ahora enlaza a detalle, búsqueda y
          pantallas de trabajo sin CTAs muertos.
        </p>

        <button
          className="hero-search hero-search--button"
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar restaurantes o tipos de plato"
        >
          <span aria-hidden="true">🔍</span>
          <span>Buscar restaurantes o tipos de plato</span>
        </button>
      </article>

      <div className="screen-note">
        Datos sincronizados: últimos platos, tops por categoría y restaurantes con
        score real.
      </div>

      <SectionHeader
        title="Últimos platos añadidos"
        actionLabel="Ver todo"
        onAction={() => onNavigate?.('lists')}
      />
      <div className="horizontal-scroll">
        {latestEntries.map((dish) => (
          <button
            key={dish.id}
            className="list-card list-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'dishEntry', id: dish.id })}
          >
            <div className="list-card__title">
              <span className="emoji-badge" aria-hidden="true">
                {categories.find((category) => category.id === dish.categoria_id)?.icono}
              </span>
              <div>
                <strong>{dish.dishTypeName}</strong>
                <p>{dish.restaurantName}</p>
              </div>
            </div>
            <div className="list-card__meta">
              <span className="status-pill">{dish.visibility}</span>
              <span
                className={`ranking-card__score ranking-card__score--${getScoreTone(dish.puntuacion_general)}`}
              >
                {formatScore(dish.puntuacion_general)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <SectionHeader
        title="Top por categoría"
        actionLabel="Explorar"
        onAction={() => onNavigate?.('rankings')}
      />
      <div className="chip-row">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`chip${category.id === activeCategoryId ? ' chip--active' : ''}`}
            type="button"
            onClick={() => setActiveCategoryId(category.id)}
          >
            {category.icono} {category.nombre}
          </button>
        ))}
      </div>

      {topByCategory ? (
        <button
          className="surface-card surface-card--button"
          type="button"
          onClick={() =>
            onOpenEntity?.({
              type: 'restaurant',
              id: topByCategory.restaurantId,
            })
          }
        >
          <strong>
            {topByCategory.categoryIcon} {topByCategory.restaurantName}
          </strong>
          <p>
            {topByCategory.dishTypeName} • {formatScore(topByCategory.score)} •{' '}
            {topByCategory.votos} votos
          </p>
        </button>
      ) : (
        <article className="surface-card">
          <strong>Sin datos aún</strong>
          <p>Aquí aparecerá el top de la categoría seleccionada.</p>
        </article>
      )}

      <SectionHeader
        title="Restaurantes cercanos"
        actionLabel="Ubicarme"
        onAction={() => onNavigate?.('map')}
      />
      <div className="list-stack">
        {restaurantsByScore.slice(0, 3).map((restaurant) => (
          <button
            key={restaurant.id}
            className="surface-card surface-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'restaurant', id: restaurant.id })}
          >
            <strong>{restaurant.nombre}</strong>
            <p>
              {restaurant.direccion_texto} • {restaurant.precio_rango} •{' '}
              {formatScore(restaurant.restaurant_score)}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

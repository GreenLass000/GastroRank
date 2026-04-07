import { useState } from 'react'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatScore } from '../lib/format.js'
import { getScoreTone } from '../lib/scoring.js'

export function HomeScreen() {
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
          Esta home ya consume datos seed sincronizados con la base SQLite del
          proyecto.
        </p>

        <div className="hero-search" role="search">
          <span aria-hidden="true">🔍</span>
          <span>Buscar restaurantes o tipos de plato</span>
        </div>
      </article>

      <div className="screen-note">
        Datos seed cargados: últimos platos, top por categoría y restaurantes
        con score real ya salen del estado compartido.
      </div>

      <SectionHeader title="Últimos platos añadidos" actionLabel="Ver todo" />
      <div className="horizontal-scroll">
        {latestEntries.map((dish) => (
          <article key={dish.id} className="list-card">
            <div className="list-card__title">
              <span className="emoji-badge" aria-hidden="true">
                {
                  categories.find((category) => category.id === dish.categoria_id)
                    ?.icono
                }
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
          </article>
        ))}
      </div>

      <SectionHeader title="Top por categoría" actionLabel="Explorar" />
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
        <article className="surface-card">
          <strong>
            {topByCategory.categoryIcon} {topByCategory.restaurantName}
          </strong>
          <p>
            {topByCategory.dishTypeName} • {formatScore(topByCategory.score)} •{' '}
            {topByCategory.votos} votos
          </p>
        </article>
      ) : (
        <article className="surface-card">
          <strong>Sin datos aún</strong>
          <p>Aquí aparecerá el top de la categoría seleccionada.</p>
        </article>
      )}

      <SectionHeader title="Restaurantes cercanos" actionLabel="Ubicarme" />
      <div className="list-stack">
        {restaurantsByScore.slice(0, 2).map((restaurant) => (
          <article key={restaurant.id} className="surface-card">
            <strong>{restaurant.nombre}</strong>
            <p>
              {restaurant.direccion_texto} • {restaurant.precio_rango} •{' '}
              {formatScore(restaurant.restaurant_score)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

import { formatScore } from '../../lib/format.js'
import { getScoreTone } from '../../lib/scoring.js'
import { ReactionRow } from './ReactionRow.jsx'

function renderAvatar(value) {
  if (!value) {
    return <span className="community-avatar">👤</span>
  }

  if (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')
  ) {
    return (
      <span className="community-avatar community-avatar--image">
        <img src={value} alt="" />
      </span>
    )
  }

  return <span className="community-avatar">{value}</span>
}

export function CommunityCard({ entry, onOpen, onSave }) {
  const categoryIcon = entry.category?.icono ?? '🍽️'

  return (
    <article className="community-card">
      <button
        className="community-card__save"
        type="button"
        onClick={() => onSave?.(entry)}
        aria-label={`Guardar ${entry.dishType?.nombre ?? entry.nombre_plato ?? 'plato'} para inspiración`}
      >
        🔖
      </button>
      <button
        className="community-card__content"
        type="button"
        onClick={() => onOpen?.(entry)}
      >
        {entry.foto_url ? (
          <img
            className="community-card__image"
            src={entry.foto_url}
            alt={entry.nombre_plato ?? entry.dishType?.nombre ?? 'Plato'}
          />
        ) : (
          <div className="community-card__placeholder">
            <span aria-hidden="true">{categoryIcon}</span>
          </div>
        )}
        <div className="community-card__body">
          <div className="community-card__header">
            <strong>{entry.nombre_plato ?? entry.dishType?.nombre ?? 'Plato'}</strong>
            <span
              className={`ranking-card__score ranking-card__score--${getScoreTone(entry.puntuacion_general)}`}
            >
              {formatScore(entry.puntuacion_general ?? 0)}
            </span>
          </div>
          <p className="community-card__restaurant">
            {entry.restaurant?.nombre ?? 'Restaurante'}
          </p>
          <div className="community-card__author">
            {renderAvatar(entry.author?.avatar_url ?? '')}
            <span>{entry.author?.nombre ?? 'Usuario'}</span>
          </div>
          <ReactionRow
            mode="compact"
            reactionsSummary={entry.reactions_summary ?? []}
            userReactionType={entry.user_reaction?.reaction_type ?? ''}
          />
        </div>
      </button>
    </article>
  )
}

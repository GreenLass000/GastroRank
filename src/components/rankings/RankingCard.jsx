import { formatScore } from '../../lib/format.js'
import { getScoreTone } from '../../lib/scoring.js'

export function RankingCard({ entry, index, onSelect }) {
  return (
    <button
      className="ranking-card ranking-card--button"
      type="button"
      onClick={() => onSelect?.(entry)}
    >
      <div className="ranking-card__meta">
        <div className="ranking-card__title">
          <span className="emoji-badge" aria-hidden="true">
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🍽️'}
          </span>
          <div>
            <strong>
              {index + 1}. {entry.restaurantName}
            </strong>
            <p>
              {entry.dishTypeName ?? entry.categoryName ?? entry.dishName ?? 'Ranking'}
              {' • '}
              {entry.votos} votos
            </p>
          </div>
        </div>
        <span
          className={`ranking-card__score ranking-card__score--${getScoreTone(entry.score)}`}
        >
          {formatScore(entry.score)}
        </span>
      </div>
    </button>
  )
}

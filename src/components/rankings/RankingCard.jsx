import { formatScore } from '../../lib/format.js'
import { getScoreTone } from '../../lib/scoring.js'

function getRankBadge(index) {
  if (index === 0) {
    return '🥇'
  }

  if (index === 1) {
    return '🥈'
  }

  if (index === 2) {
    return '🥉'
  }

  return String(index + 1)
}

export function RankingCard({ entry, index, isExpanded = false, onToggle }) {
  return (
    <button
      className={`ranking-card ranking-card--button ranking-card--compact${isExpanded ? ' ranking-card--expanded' : ''}`}
      type="button"
      aria-expanded={isExpanded}
      onClick={() => onToggle?.(entry)}
    >
      <span className="ranking-card__compact-rank" aria-hidden="true">
        {getRankBadge(index)}
      </span>

      <div className="ranking-card__compact-main">
        <strong className="ranking-card__compact-title">
          {entry.primaryLabel ?? entry.restaurantName ?? 'Ranking'}
        </strong>
        <p className="ranking-card__compact-subtitle">
          {entry.secondaryLabel ?? entry.dishTypeName ?? entry.categoryName ?? entry.dishName ?? 'Sin detalle'}
        </p>
      </div>

      <div className="ranking-card__compact-side">
        <span
          className={`ranking-card__score ranking-card__score--${getScoreTone(entry.score)}`}
        >
          {formatScore(entry.score)}
        </span>
        <span className="ranking-card__compact-count">
          {entry.countLabel ?? `${entry.votos} votos`}
        </span>
      </div>
    </button>
  )
}
